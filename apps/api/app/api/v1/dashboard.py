from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Workflow, WorkflowExecution, Approval, OrganizationMember
from app.schemas.schemas import DashboardStatsOut, ExecutionOut
from app.api.deps import get_current_org_membership

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/stats", response_model=DashboardStatsOut)
def get_dashboard_stats(
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    org_id = membership.organization_id

    total_wf = db.query(Workflow).filter(Workflow.organization_id == org_id).count()
    active_wf = db.query(Workflow).filter(Workflow.organization_id == org_id, Workflow.is_active == True).count()

    total_exec = db.query(WorkflowExecution).filter(WorkflowExecution.organization_id == org_id).count()
    success_exec = (
        db.query(WorkflowExecution)
        .filter(WorkflowExecution.organization_id == org_id, WorkflowExecution.status == "SUCCEEDED")
        .count()
    )
    failed_exec = (
        db.query(WorkflowExecution)
        .filter(WorkflowExecution.organization_id == org_id, WorkflowExecution.status == "FAILED")
        .count()
    )

    pending_appr = (
        db.query(Approval)
        .filter(Approval.organization_id == org_id, Approval.status == "PENDING")
        .count()
    )

    recent_execs_db = (
        db.query(WorkflowExecution)
        .filter(WorkflowExecution.organization_id == org_id)
        .order_by(WorkflowExecution.started_at.desc())
        .limit(5)
        .all()
    )

    recent_execs = []
    for ex in recent_execs_db:
        item = ExecutionOut.model_validate(ex)
        if ex.workflow:
            item.workflow_name = ex.workflow.name
        recent_execs.append(item)

    return DashboardStatsOut(
        total_workflows=total_wf,
        active_workflows=active_wf,
        total_executions=total_exec,
        successful_executions=success_exec,
        failed_executions=failed_exec,
        pending_approvals=pending_appr,
        recent_executions=recent_execs,
    )
