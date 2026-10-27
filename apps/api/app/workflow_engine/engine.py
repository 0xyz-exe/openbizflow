import json
import re
import time
import copy
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import httpx
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from app.models.models import (
    WorkflowExecution,
    NodeExecution,
    Approval,
    AuditLog,
)
from app.workflow_engine.ssrf import validate_url_safe

def now_utc():
    return datetime.now(timezone.utc)

def resolve_path_in_dict(path: str, context: Dict[str, Any]) -> Any:
    """Extracts a value like 'trigger.payload.user_id' or 'nodes.step_1.output.total'."""
    tokens = path.strip().split(".")
    curr = context
    for token in tokens:
        if isinstance(curr, dict) and token in curr:
            curr = curr[token]
        else:
            return None
    return curr

def resolve_variables(value: Any, context: Dict[str, Any]) -> Any:
    """
    Recursively interpolates expressions like {{ trigger.payload.id }}
    """
    if isinstance(value, str):
        # Exact match: {{ path }} -> preserves object type (dict, list, int, etc.)
        exact_match = re.fullmatch(r"\{\{\s*([\w\.\-]+)\s*\}\}", value)
        if exact_match:
            path = exact_match.group(1)
            resolved = resolve_path_in_dict(path, context)
            return resolved if resolved is not None else ""
        
        # Substring replacement
        def replace_match(match):
            path = match.group(1)
            res = resolve_path_in_dict(path, context)
            return str(res) if res is not None else ""

        return re.sub(r"\{\{\s*([\w\.\-]+)\s*\}\}", replace_match, value)

    elif isinstance(value, dict):
        return {k: resolve_variables(v, context) for k, v in value.items()}
    elif isinstance(value, list):
        return [resolve_variables(v, context) for v in value]
    return value

class WorkflowEngine:
    def __init__(self, db: Session):
        self.db = db

    def execute_workflow(self, execution_id: str) -> WorkflowExecution:
        execution = self.db.query(WorkflowExecution).filter(WorkflowExecution.id == execution_id).first()
        if not execution:
            raise ValueError(f"Execution {execution_id} not found.")

        workflow = execution.workflow
        definition = workflow.definition or {}
        nodes: List[Dict[str, Any]] = definition.get("nodes", [])
        edges: List[Dict[str, Any]] = definition.get("edges", [])

        node_map = {n["id"]: n for n in nodes}
        # Outgoing edges: node_id -> list of edge dicts
        out_edges: Dict[str, List[Dict[str, Any]]] = {n["id"]: [] for n in nodes}
        in_degrees: Dict[str, int] = {n["id"]: 0 for n in nodes}

        for e in edges:
            src = e.get("source")
            tgt = e.get("target")
            if src in out_edges and tgt in in_degrees:
                out_edges[src].append(e)
                in_degrees[tgt] += 1

        # Execution context holds trigger and node outputs
        context = execution.context or {}
        if "trigger" not in context:
            context["trigger"] = {"payload": execution.trigger_payload or {}}
        if "nodes" not in context:
            context["nodes"] = {}

        execution.status = "RUNNING"
        execution.started_at = now_utc()
        self.db.commit()

        start_time_all = time.time()

        # Find initial trigger node
        ready_nodes = [nid for nid in node_map if in_degrees[nid] == 0]
        # Active set of allowed edges (for condition branching)
        disabled_edges: set = set()

        halted_waiting = False
        execution_failed = False
        failure_error = None

        while ready_nodes:
            curr_id = ready_nodes.pop(0)
            curr_node = node_map[curr_id]
            node_type = curr_node.get("type")
            node_data = curr_node.get("data", {})
            node_name = node_data.get("label", curr_id)

            # Check if this node was skipped because all incoming edges were disabled
            incoming_edges = [e for e in edges if e.get("target") == curr_id]
            if incoming_edges and all(e.get("id") in disabled_edges for e in incoming_edges):
                # Skip this node
                node_exec = NodeExecution(
                    execution_id=execution.id,
                    node_id=curr_id,
                    node_name=node_name,
                    node_type=node_type,
                    status="SKIPPED",
                    started_at=now_utc(),
                    completed_at=now_utc(),
                    duration_ms=0,
                )
                self.db.add(node_exec)
                self.db.commit()
                # Disable outgoing edges from skipped node as well
                for out_e in out_edges[curr_id]:
                    disabled_edges.add(out_e.get("id"))
                continue

            # Check if this node was already executed (e.g. when resuming after approval)
            if curr_id in context.get("nodes", {}) and context["nodes"][curr_id].get("status") == "SUCCEEDED":
                for out_e in out_edges[curr_id]:
                    tgt = out_e.get("target")
                    in_degrees[tgt] -= 1
                    if in_degrees[tgt] == 0:
                        ready_nodes.append(tgt)
                continue

            # Record NodeExecution start
            node_exec = NodeExecution(
                execution_id=execution.id,
                node_id=curr_id,
                node_name=node_name,
                node_type=node_type,
                status="RUNNING",
                started_at=now_utc(),
            )
            self.db.add(node_exec)
            self.db.commit()

            node_start = time.time()
            try:
                result = self._execute_single_node(curr_node, context, execution)
                node_exec.status = result.get("status", "SUCCEEDED")
                node_exec.input_data = result.get("input_data", {})
                node_exec.output_data = result.get("output_data", {})
                node_exec.error = result.get("error")
                node_exec.completed_at = now_utc()
                node_exec.duration_ms = int((time.time() - node_start) * 1000)

                # Store node output in context
                if curr_id:
                    context["nodes"][curr_id] = {
                        "status": node_exec.status,
                        "output": node_exec.output_data,
                    }
                self.db.commit()

                # Handle approval pause
                if node_exec.status == "WAITING":
                    halted_waiting = True
                    execution.status = "WAITING"
                    execution.context = context
                    flag_modified(execution, "context")
                    self.db.commit()
                    break

                # Handle condition branching
                if node_type == "condition":
                    active_branch = result.get("active_branch")  # "true" or "false"
                    for out_e in out_edges[curr_id]:
                        handle = out_e.get("sourceHandle")
                        if handle and handle != active_branch:
                            disabled_edges.add(out_e.get("id"))

                # Schedule next nodes
                for out_e in out_edges[curr_id]:
                    tgt = out_e.get("target")
                    in_degrees[tgt] -= 1
                    if in_degrees[tgt] == 0:
                        ready_nodes.append(tgt)

            except Exception as e:
                node_exec.status = "FAILED"
                node_exec.error = str(e)
                node_exec.completed_at = now_utc()
                node_exec.duration_ms = int((time.time() - node_start) * 1000)
                self.db.commit()

                execution_failed = True
                failure_error = f"Node '{node_name}' ({curr_id}) failed: {str(e)}"
                break

        total_duration = int((time.time() - start_time_all) * 1000)
        execution.context = context
        execution.duration_ms += total_duration

        if halted_waiting:
            execution.status = "WAITING"
        elif execution_failed:
            execution.status = "FAILED"
            execution.error = failure_error
            execution.completed_at = now_utc()
        else:
            execution.status = "SUCCEEDED"
            execution.completed_at = now_utc()

        self.db.commit()
        return execution

    def _execute_single_node(self, node: Dict[str, Any], context: Dict[str, Any], execution: WorkflowExecution) -> Dict[str, Any]:
        node_type = node.get("type")
        raw_data = node.get("data", {})
        node_id = node.get("id")

        if node_type in ("manual_trigger", "webhook_trigger", "schedule_trigger"):
            output = context.get("trigger", {}).get("payload", {})
            return {"status": "SUCCEEDED", "input_data": {}, "output_data": output}

        elif node_type == "http_request":
            url = resolve_variables(raw_data.get("url", ""), context)
            method = raw_data.get("method", "GET").upper()
            headers = resolve_variables(raw_data.get("headers", {}), context)
            body = resolve_variables(raw_data.get("body", None), context)

            # SSRF check
            validate_url_safe(url)

            # Make HTTP Request
            with httpx.Client(timeout=15.0, follow_redirects=False) as client:
                req_kwargs: Dict[str, Any] = {"headers": headers}
                if body is not None:
                    if isinstance(body, dict):
                        req_kwargs["json"] = body
                    else:
                        req_kwargs["content"] = str(body)

                response = client.request(method, url, **req_kwargs)
                try:
                    resp_body = response.json()
                except Exception:
                    resp_body = response.text[:2000]

                output = {
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                    "body": resp_body,
                }
                return {
                    "status": "SUCCEEDED" if response.is_success else "FAILED",
                    "input_data": {"url": url, "method": method, "headers": headers, "body": body},
                    "output_data": output,
                    "error": None if response.is_success else f"HTTP {response.status_code}: {response.text[:200]}",
                }

        elif node_type == "condition":
            left_raw = raw_data.get("left_operand", "")
            right_raw = raw_data.get("right_operand", "")
            operator = raw_data.get("operator", "eq")

            left = resolve_variables(left_raw, context)
            right = resolve_variables(right_raw, context)

            result_bool = self._evaluate_condition(left, operator, right)
            branch = "true" if result_bool else "false"

            return {
                "status": "SUCCEEDED",
                "active_branch": branch,
                "input_data": {"left": left, "operator": operator, "right": right},
                "output_data": {"condition_met": result_bool, "selected_branch": branch},
            }

        elif node_type == "transform":
            mapping = raw_data.get("mapping", {})
            transformed = resolve_variables(mapping, context)
            return {
                "status": "SUCCEEDED",
                "input_data": mapping,
                "output_data": transformed,
            }

        elif node_type == "email":
            to_email = resolve_variables(raw_data.get("to", ""), context)
            subject = resolve_variables(raw_data.get("subject", ""), context)
            body = resolve_variables(raw_data.get("body", ""), context)

            # Mock delivery recording
            output = {
                "delivered": True,
                "to": to_email,
                "subject": subject,
                "timestamp": now_utc().isoformat(),
            }
            return {
                "status": "SUCCEEDED",
                "input_data": {"to": to_email, "subject": subject, "body": body},
                "output_data": output,
            }

        elif node_type == "notification":
            title = resolve_variables(raw_data.get("title", "Notification"), context)
            message = resolve_variables(raw_data.get("message", ""), context)
            output = {"delivered": True, "title": title, "message": message, "timestamp": now_utc().isoformat()}
            return {
                "status": "SUCCEEDED",
                "input_data": {"title": title, "message": message},
                "output_data": output,
            }

        elif node_type == "log":
            message = resolve_variables(raw_data.get("message", ""), context)
            level = raw_data.get("level", "INFO").upper()
            return {
                "status": "SUCCEEDED",
                "input_data": {"message": message, "level": level},
                "output_data": {"logged": True, "level": level, "message": message},
            }

        elif node_type == "approval":
            prompt = resolve_variables(raw_data.get("prompt", "Human approval required"), context)
            # Create Approval record
            approval = Approval(
                organization_id=execution.organization_id,
                execution_id=execution.id,
                node_id=node_id,
                prompt=prompt,
                status="PENDING",
            )
            self.db.add(approval)
            self.db.commit()

            return {
                "status": "WAITING",
                "input_data": {"prompt": prompt},
                "output_data": {"approval_id": approval.id, "status": "PENDING"},
            }

        else:
            raise ValueError(f"Unknown node type: {node_type}")

    def _evaluate_condition(self, left: Any, operator: str, right: Any) -> bool:
        if operator == "eq":
            return str(left) == str(right)
        elif operator == "neq":
            return str(left) != str(right)
        elif operator == "gt":
            try:
                return float(left) > float(right)
            except Exception:
                return str(left) > str(right)
        elif operator == "gte":
            try:
                return float(left) >= float(right)
            except Exception:
                return str(left) >= str(right)
        elif operator == "lt":
            try:
                return float(left) < float(right)
            except Exception:
                return str(left) < str(right)
        elif operator == "lte":
            try:
                return float(left) <= float(right)
            except Exception:
                return str(left) <= str(right)
        elif operator == "contains":
            if isinstance(left, (list, dict, str)):
                return str(right) in str(left)
            return False
        elif operator == "exists":
            return left is not None and left != ""
        elif operator == "not_exists":
            return left is None or left == ""
        return False

    def resume_after_approval(self, approval_id: str, decision: str, comments: Optional[str], approver_id: Optional[str]) -> WorkflowExecution:
        approval = self.db.query(Approval).filter(Approval.id == approval_id).first()
        if not approval:
            raise ValueError("Approval record not found.")

        if approval.status != "PENDING":
            raise ValueError(f"Approval has already been decided: {approval.status}")

        approval.status = "APPROVED" if decision == "approve" else "REJECTED"
        approval.comments = comments
        approval.approver_id = approver_id
        approval.decided_at = now_utc()

        execution = approval.execution
        if execution.status != "WAITING":
            raise ValueError(f"Execution is not in WAITING state (current: {execution.status}).")

        # Update node execution record for the approval node
        node_exec = (
            self.db.query(NodeExecution)
            .filter(NodeExecution.execution_id == execution.id, NodeExecution.node_id == approval.node_id)
            .order_by(NodeExecution.started_at.desc())
            .first()
        )
        if node_exec:
            node_exec.status = "SUCCEEDED"
            node_exec.output_data = {
                "decision": approval.status,
                "approved": approval.status == "APPROVED",
                "comments": comments,
                "decided_at": approval.decided_at.isoformat(),
            }
            node_exec.completed_at = now_utc()

        # Update context
        context = copy.deepcopy(execution.context or {})
        if "nodes" not in context:
            context["nodes"] = {}
        context["nodes"][approval.node_id] = {
            "status": "SUCCEEDED",
            "output": {
                "decision": approval.status,
                "approved": approval.status == "APPROVED",
                "comments": comments,
            },
        }
        execution.context = context
        flag_modified(execution, "context")

        # If rejected, mark execution FAILED (or let condition downstream handle it)
        if approval.status == "REJECTED":
            execution.status = "FAILED"
            execution.error = f"Workflow rejected during approval: {comments or 'No reason provided'}"
            execution.completed_at = now_utc()
            self.db.commit()
            return execution

        # Resume execution
        execution.status = "RUNNING"
        self.db.commit()
        return self.execute_workflow(execution.id)
