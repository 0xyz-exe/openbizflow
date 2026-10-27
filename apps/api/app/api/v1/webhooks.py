import hmac
import hashlib
import json
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.models.models import WebhookEndpoint, Workflow, WorkflowExecution, IdempotencyRecord
from app.workflow_engine.validator import validate_workflow_graph
from app.workflow_engine.engine import WorkflowEngine

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

@router.post("/{endpoint_token}")
async def receive_webhook(
    endpoint_token: str,
    request: Request,
    db: Session = Depends(get_db),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    x_signature: Optional[str] = Header(None, alias="X-OpenBizFlow-Signature"),
):
    endpoint = (
        db.query(WebhookEndpoint)
        .filter(WebhookEndpoint.endpoint_token == endpoint_token, WebhookEndpoint.is_active == True)
        .first()
    )
    if not endpoint:
        raise HTTPException(status_code=404, detail="Webhook endpoint not found or inactive.")

    body_bytes = await request.body()
    try:
        payload = json.loads(body_bytes.decode()) if body_bytes else {}
    except Exception:
        payload = {"raw_body": body_bytes.decode(errors="replace")}

    # HMAC Signature Verification if secret is configured
    if endpoint.secret:
        if not x_signature:
            raise HTTPException(status_code=401, detail="Signature missing: X-OpenBizFlow-Signature required.")
        expected_sig = hmac.new(endpoint.secret.encode(), body_bytes, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected_sig, x_signature):
            raise HTTPException(status_code=401, detail="Invalid HMAC signature.")

    # Idempotency check
    if x_idempotency_key:
        existing_rec = (
            db.query(IdempotencyRecord)
            .filter(
                IdempotencyRecord.organization_id == endpoint.organization_id,
                IdempotencyRecord.idempotency_key == x_idempotency_key,
            )
            .first()
        )
        if existing_rec:
            # Return duplicate response
            existing_exec = db.query(WorkflowExecution).filter(WorkflowExecution.id == existing_rec.execution_id).first()
            return {
                "idempotent_duplicate": True,
                "execution_id": existing_rec.execution_id,
                "status": existing_exec.status if existing_exec else "UNKNOWN",
            }

    workflow = db.query(Workflow).filter(Workflow.id == endpoint.workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Associated workflow not found.")

    if not workflow.is_active:
        raise HTTPException(status_code=400, detail="Associated workflow is not active.")

    val_res = validate_workflow_graph(workflow.definition or {})
    if not val_res["is_valid"]:
        raise HTTPException(status_code=400, detail="Associated workflow definition is invalid.")

    # Create Execution
    execution = WorkflowExecution(
        organization_id=endpoint.organization_id,
        workflow_id=workflow.id,
        workflow_version=workflow.version,
        trigger_type="webhook",
        status="QUEUED",
        trigger_payload={"payload": payload, "headers": dict(request.headers)},
        context={
            "trigger": {
                "payload": payload,
                "headers": dict(request.headers),
            },
            "nodes": {},
        },
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)

    # Save idempotency record
    if x_idempotency_key:
        idemp = IdempotencyRecord(
            organization_id=endpoint.organization_id,
            idempotency_key=x_idempotency_key,
            execution_id=execution.id,
        )
        db.add(idemp)
        db.commit()

    # Run workflow
    engine = WorkflowEngine(db)
    finished = engine.execute_workflow(execution.id)

    return {
        "execution_id": finished.id,
        "workflow_id": workflow.id,
        "status": finished.status,
        "duration_ms": finished.duration_ms,
    }
