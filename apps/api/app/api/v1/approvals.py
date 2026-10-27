from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.models import Approval, OrganizationMember, User, WorkflowExecution, Workflow
from app.schemas.schemas import ApprovalOut, ApprovalDecisionReq, ExecutionOut
from app.api.deps import get_current_org_membership
from app.workflow_engine.engine import WorkflowEngine

router = APIRouter(prefix="/approvals", tags=["approvals"])

@router.get("/", response_model=List[ApprovalOut])
def list_approvals(
    status: Optional[str] = Query(None),
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    query = db.query(Approval).filter(Approval.organization_id == membership.organization_id)
    if status:
        query = query.filter(Approval.status == status.upper())

    approvals = query.order_by(Approval.created_at.desc()).all()
    results = []
    for ap in approvals:
        item = ApprovalOut.model_validate(ap)
        if ap.execution and ap.execution.workflow:
            item.workflow_id = ap.execution.workflow_id
            item.workflow_name = ap.execution.workflow.name
        if ap.requester_id:
            req_u = db.query(User).filter(User.id == ap.requester_id).first()
            if req_u:
                item.requester_email = req_u.email
        if ap.approver_id:
            app_u = db.query(User).filter(User.id == ap.approver_id).first()
            if app_u:
                item.approver_email = app_u.email
        results.append(item)
    return results

@router.post("/{approval_id}/decide", response_model=ExecutionOut)
def decide_approval(
    approval_id: str,
    req: ApprovalDecisionReq,
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    if membership.role in ("viewer", "operator"):
        raise HTTPException(status_code=403, detail="Insufficient role to approve or reject requests.")

    decision_norm = req.decision.lower().strip()
    if decision_norm not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Decision must be 'approve' or 'reject'.")

    approval = (
        db.query(Approval)
        .filter(Approval.id == approval_id, Approval.organization_id == membership.organization_id)
        .first()
    )
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found.")

    engine = WorkflowEngine(db)
    try:
        updated_exec = engine.resume_after_approval(
            approval_id=approval.id,
            decision=decision_norm,
            comments=req.comments,
            approver_id=membership.user_id,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    res = ExecutionOut.model_validate(updated_exec)
    if updated_exec.workflow:
        res.workflow_name = updated_exec.workflow.name
    return res
