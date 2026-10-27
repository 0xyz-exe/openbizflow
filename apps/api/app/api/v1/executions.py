from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from app.core.database import get_db
from app.models.models import WorkflowExecution, OrganizationMember, Workflow
from app.schemas.schemas import ExecutionOut
from app.api.deps import get_current_org_membership

router = APIRouter(prefix="/executions", tags=["executions"])

@router.get("/", response_model=List[ExecutionOut])
def list_executions(
    workflow_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    query = (
        db.query(WorkflowExecution)
        .filter(WorkflowExecution.organization_id == membership.organization_id)
    )
    if workflow_id:
        query = query.filter(WorkflowExecution.workflow_id == workflow_id)
    if status:
        query = query.filter(WorkflowExecution.status == status.upper())

    executions = query.order_by(WorkflowExecution.started_at.desc()).offset(offset).limit(limit).all()

    result = []
    for ex in executions:
        item = ExecutionOut.model_validate(ex)
        if ex.workflow:
            item.workflow_name = ex.workflow.name
        result.append(item)
    return result

@router.get("/{execution_id}", response_model=ExecutionOut)
def get_execution_detail(
    execution_id: str,
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    execution = (
        db.query(WorkflowExecution)
        .filter(
            WorkflowExecution.id == execution_id,
            WorkflowExecution.organization_id == membership.organization_id,
        )
        .first()
    )
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found.")

    res = ExecutionOut.model_validate(execution)
    if execution.workflow:
        res.workflow_name = execution.workflow.name
    return res

@router.post("/{execution_id}/cancel", response_model=ExecutionOut)
def cancel_execution(
    execution_id: str,
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    if membership.role in ("viewer",):
        raise HTTPException(status_code=403, detail="Viewers cannot cancel executions.")

    execution = (
        db.query(WorkflowExecution)
        .filter(
            WorkflowExecution.id == execution_id,
            WorkflowExecution.organization_id == membership.organization_id,
        )
        .first()
    )
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found.")

    if execution.status in ("SUCCEEDED", "FAILED", "CANCELLED"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel finished execution (status: {execution.status}).")

    execution.status = "CANCELLED"
    execution.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(execution)

    res = ExecutionOut.model_validate(execution)
    if execution.workflow:
        res.workflow_name = execution.workflow.name
    return res
