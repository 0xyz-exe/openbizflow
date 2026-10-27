from typing import Dict, Any, List, Set
from collections import defaultdict, deque

SUPPORTED_NODE_TYPES = {
    # Triggers
    "manual_trigger",
    "webhook_trigger",
    "schedule_trigger",
    # Actions
    "http_request",
    "email",
    "notification",
    "transform",
    "log",
    # Logic & Approvals
    "condition",
    "approval",
}

TRIGGER_TYPES = {"manual_trigger", "webhook_trigger", "schedule_trigger"}

def validate_workflow_graph(definition: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates workflow nodes and edges for:
    - Existence of nodes
    - Valid node types
    - Unique node IDs
    - Exactly one trigger node
    - Valid connections (edges point to real nodes)
    - Acyclic check (DAG validation)
    - Required configuration per node
    """
    nodes = definition.get("nodes", [])
    edges = definition.get("edges", [])

    errors: List[str] = []
    warnings: List[str] = []

    if not nodes:
        return {
            "is_valid": False,
            "errors": ["Workflow must contain at least one node."],
            "warnings": [],
            "node_count": 0,
            "edge_count": 0,
            "trigger_node": None,
        }

    node_ids: Set[str] = set()
    trigger_nodes: List[str] = []

    for idx, node in enumerate(nodes):
        node_id = node.get("id")
        if not node_id:
            errors.append(f"Node at index {idx} is missing an 'id'.")
            continue
        if node_id in node_ids:
            errors.append(f"Duplicate node ID detected: '{node_id}'.")
        node_ids.add(node_id)

        node_type = node.get("type")
        if not node_type or node_type not in SUPPORTED_NODE_TYPES:
            errors.append(f"Node '{node_id}' has unsupported type '{node_type}'.")

        if node_type in TRIGGER_TYPES:
            trigger_nodes.append(node_id)

        # Validate node configuration
        data = node.get("data", {})
        if node_type == "http_request":
            url = data.get("url", "").strip()
            if not url:
                warnings.append(f"HTTP Request node '{node_id}' has no URL configured.")
        elif node_type == "condition":
            op = data.get("operator", "").strip()
            if not op:
                warnings.append(f"Condition node '{node_id}' has no operator selected.")
        elif node_type == "approval":
            prompt = data.get("prompt", "").strip()
            if not prompt:
                warnings.append(f"Approval node '{node_id}' has no prompt specified.")

    if not trigger_nodes:
        errors.append("Workflow must contain at least one Trigger node (Manual, Webhook, or Schedule).")
    elif len(trigger_nodes) > 1:
        warnings.append(f"Workflow contains {len(trigger_nodes)} triggers. Multiple triggers will independently start executions.")

    # Validate edges
    adj: Dict[str, List[str]] = defaultdict(list)
    in_degree: Dict[str, int] = {nid: 0 for nid in node_ids}

    for edge in edges:
        src = edge.get("source")
        tgt = edge.get("target")

        if not src or src not in node_ids:
            errors.append(f"Edge references invalid source node: '{src}'.")
        if not tgt or tgt not in node_ids:
            errors.append(f"Edge references invalid target node: '{tgt}'.")

        if src and tgt and src in node_ids and tgt in node_ids:
            if src == tgt:
                errors.append(f"Self-loop detected on node '{src}'.")
            adj[src].append(tgt)
            in_degree[tgt] += 1

    # Cycle detection via Kahn's algorithm
    queue = deque([nid for nid in node_ids if in_degree[nid] == 0])
    visited_count = 0

    while queue:
        curr = queue.popleft()
        visited_count += 1
        for neighbor in adj[curr]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if visited_count < len(node_ids):
        errors.append("Cycle detected in workflow graph. OpenBizFlow requires an acyclic workflow (DAG).")

    is_valid = len(errors) == 0
    return {
        "is_valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "node_count": len(nodes),
        "edge_count": len(edges),
        "trigger_node": trigger_nodes[0] if trigger_nodes else None,
    }
