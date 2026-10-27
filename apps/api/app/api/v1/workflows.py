from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.models import (
    Workflow,
    WorkflowVersion,
    WorkflowExecution,
    WebhookEndpoint,
    OrganizationMember,
)
from app.schemas.schemas import (
    WorkflowCreate,
    WorkflowUpdate,
    WorkflowOut,
    WorkflowValidationResult,
    ExecutionOut,
    ExecutionTriggerReq,
)
from app.api.deps import get_current_org_membership
from app.workflow_engine.validator import validate_workflow_graph
from app.workflow_engine.engine import WorkflowEngine
import secrets

router = APIRouter(prefix="/workflows", tags=["workflows"])

@router.get("/", response_model=List[WorkflowOut])
def list_workflows(
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    workflows = (
        db.query(Workflow)
        .filter(Workflow.organization_id == membership.organization_id)
        .order_by(Workflow.updated_at.desc())
        .all()
    )
    return workflows

@router.post("/", response_model=WorkflowOut)
def create_workflow(
    req: WorkflowCreate,
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    if membership.role in ("viewer", "operator"):
        raise HTTPException(status_code=403, detail="Insufficient permissions to create workflows.")

    definition_dict = req.definition.model_dump()
    workflow = Workflow(
        organization_id=membership.organization_id,
        name=req.name,
        description=req.description,
        is_active=False,
        version=1,
        definition=definition_dict,
        created_by=membership.user_id,
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)

    # Create immutable version record
    v_rec = WorkflowVersion(
        workflow_id=workflow.id,
        version=1,
        definition=definition_dict,
    )
    db.add(v_rec)

    # If workflow has webhook_trigger, automatically create WebhookEndpoint
    nodes = definition_dict.get("nodes", [])
    has_webhook = any(n.get("type") == "webhook_trigger" for n in nodes)
    if has_webhook:
        endpoint = WebhookEndpoint(
            organization_id=membership.organization_id,
            workflow_id=workflow.id,
            endpoint_token=secrets.token_hex(20),
            secret=secrets.token_hex(32),
            is_active=True,
        )
        db.add(endpoint)

    db.commit()
    db.refresh(workflow)
    return workflow

@router.get("/{workflow_id}", response_model=WorkflowOut)
def get_workflow(
    workflow_id: str,
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    workflow = (
        db.query(Workflow)
        .filter(Workflow.id == workflow_id, Workflow.organization_id == membership.organization_id)
        .first()
    )
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found.")
    return workflow

@router.put("/{workflow_id}", response_model=WorkflowOut)
def update_workflow(
    workflow_id: str,
    req: WorkflowUpdate,
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    if membership.role in ("viewer", "operator"):
        raise HTTPException(status_code=403, detail="Insufficient permissions to update workflows.")

    workflow = (
        db.query(Workflow)
        .filter(Workflow.id == workflow_id, Workflow.organization_id == membership.organization_id)
        .first()
    )
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    if req.name is not None:
        workflow.name = req.name
    if req.description is not None:
        workflow.description = req.description
    if req.is_active is not None:
        workflow.is_active = req.is_active

    if req.definition is not None:
        new_def = req.definition.model_dump()
        workflow.definition = new_def
        workflow.version += 1
        # Store immutable version history
        v_rec = WorkflowVersion(
            workflow_id=workflow.id,
            version=workflow.version,
            definition=new_def,
        )
        db.add(v_rec)

        # Check webhook endpoint
        nodes = new_def.get("nodes", [])
        has_webhook = any(n.get("type") == "webhook_trigger" for n in nodes)
        ep = db.query(WebhookEndpoint).filter(WebhookEndpoint.workflow_id == workflow.id).first()
        if has_webhook and not ep:
            ep = WebhookEndpoint(
                organization_id=membership.organization_id,
                workflow_id=workflow.id,
                endpoint_token=secrets.token_hex(20),
                secret=secrets.token_hex(32),
                is_active=True,
            )
            db.add(ep)

    db.commit()
    db.refresh(workflow)
    return workflow

@router.delete("/{workflow_id}")
def delete_workflow(
    workflow_id: str,
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    if membership.role in ("viewer", "operator"):
        raise HTTPException(status_code=403, detail="Insufficient permissions to delete workflows.")

    workflow = (
        db.query(Workflow)
        .filter(Workflow.id == workflow_id, Workflow.organization_id == membership.organization_id)
        .first()
    )
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    db.delete(workflow)
    db.commit()
    return {"success": True, "message": "Workflow deleted."}

@router.post("/{workflow_id}/validate", response_model=WorkflowValidationResult)
def validate_workflow(
    workflow_id: str,
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    workflow = (
        db.query(Workflow)
        .filter(Workflow.id == workflow_id, Workflow.organization_id == membership.organization_id)
        .first()
    )
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    val_res = validate_workflow_graph(workflow.definition or {})
    return WorkflowValidationResult(**val_res)

@router.post("/{workflow_id}/execute", response_model=ExecutionOut)
def execute_workflow_manually(
    workflow_id: str,
    req: ExecutionTriggerReq,
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    if membership.role == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot trigger workflow executions.")

    workflow = (
        db.query(Workflow)
        .filter(Workflow.id == workflow_id, Workflow.organization_id == membership.organization_id)
        .first()
    )
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    # Validate definition before running
    val_res = validate_workflow_graph(workflow.definition or {})
    if not val_res["is_valid"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot execute invalid workflow: {', '.join(val_res['errors'])}",
        )

    # Create Execution record
    execution = WorkflowExecution(
        organization_id=membership.organization_id,
        workflow_id=workflow.id,
        workflow_version=workflow.version,
        trigger_type="manual",
        status="QUEUED",
        trigger_payload=req.payload or {},
        context={"trigger": {"payload": req.payload or {}}, "nodes": {}},
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)

    # Run execution engine
    engine = WorkflowEngine(db)
    finished_exec = engine.execute_workflow(execution.id)

    # Populate workflow name on out response
    res = ExecutionOut.model_validate(finished_exec)
    res.workflow_name = workflow.name
    return res

@router.post("/{workflow_id}/toggle", response_model=WorkflowOut)
def toggle_workflow_active(
    workflow_id: str,
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    workflow = (
        db.query(Workflow)
        .filter(Workflow.id == workflow_id, Workflow.organization_id == membership.organization_id)
        .first()
    )
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    if not workflow.is_active:
        # Validate before activation
        val = validate_workflow_graph(workflow.definition or {})
        if not val["is_valid"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot activate invalid workflow: {', '.join(val['errors'])}",
            )
        workflow.is_active = True
    else:
        workflow.is_active = False

    db.commit()
    db.refresh(workflow)
    return workflow
