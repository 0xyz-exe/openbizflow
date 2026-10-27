import hmac
import hashlib
import json
from app.models.models import WebhookEndpoint, Credential
from app.core.security import decrypt_secret

def test_webhook_trigger_and_hmac_and_idempotency(client, db_session):
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": "webhook_tester@test.com", "password": "Password123!"},
    ).json()
    token = reg["access_token"]
    org_id = reg["current_organization_id"]

    # Create workflow with webhook trigger
    wf = client.post(
        "/api/v1/workflows/",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
        json={
            "name": "Webhook Pipeline",
            "definition": {
                "nodes": [
                    {"id": "w1", "type": "webhook_trigger", "data": {"label": "Inbound"}},
                    {"id": "l1", "type": "log", "data": {"label": "Log", "message": "Received: {{trigger.payload.order_id}}"}},
                ],
                "edges": [
                    {"id": "e1", "source": "w1", "target": "l1"},
                ],
            },
        },
    ).json()

    # Activate workflow
    act_res = client.post(
        f"/api/v1/workflows/{wf['id']}/toggle",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
    )
    assert act_res.json()["is_active"] is True

    # Retrieve endpoint token and secret
    endpoint = db_session.query(WebhookEndpoint).filter(WebhookEndpoint.workflow_id == wf["id"]).first()
    assert endpoint is not None
    endpoint_token = endpoint.endpoint_token
    secret = endpoint.secret

    payload = {"order_id": "ORD-9912", "amount": 199}
    payload_bytes = json.dumps(payload).encode()
    correct_sig = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()

    # 1. Test missing signature when secret configured
    fail_sig = client.post(
        f"/api/v1/webhooks/{endpoint_token}",
        content=payload_bytes,
        headers={"Content-Type": "application/json"},
    )
    assert fail_sig.status_code == 401

    # 2. Test successful webhook execution with valid signature
    success_resp = client.post(
        f"/api/v1/webhooks/{endpoint_token}",
        content=payload_bytes,
        headers={
            "Content-Type": "application/json",
            "X-OpenBizFlow-Signature": correct_sig,
            "X-Idempotency-Key": "idemp-key-1",
        },
    )
    assert success_resp.status_code == 200
    res_data = success_resp.json()
    assert res_data["status"] == "SUCCEEDED"
    first_exec_id = res_data["execution_id"]

    # 3. Test Idempotency: replay identical request with same X-Idempotency-Key
    dup_resp = client.post(
        f"/api/v1/webhooks/{endpoint_token}",
        content=payload_bytes,
        headers={
            "Content-Type": "application/json",
            "X-OpenBizFlow-Signature": correct_sig,
            "X-Idempotency-Key": "idemp-key-1",
        },
    )
    assert dup_resp.status_code == 200
    dup_data = dup_resp.json()
    assert dup_data.get("idempotent_duplicate") is True
    assert dup_data["execution_id"] == first_exec_id

def test_credential_encryption_and_masking(client, db_session):
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": "cred_tester@test.com", "password": "Password123!"},
    ).json()
    token = reg["access_token"]
    org_id = reg["current_organization_id"]

    # Create credential
    cred_res = client.post(
        "/api/v1/credentials/",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
        json={
            "name": "Production Stripe API",
            "type": "bearer_token",
            "data": {"token": "sk_live_very_secret_key_12345"},
        },
    )
    assert cred_res.status_code == 200
    cred_id = cred_res.json()["id"]

    # Verify secret is NEVER exposed in API response
    assert "sk_live" not in cred_res.text

    # Verify secret in database is Fernet encrypted (not plaintext)
    cred_db = db_session.query(Credential).filter(Credential.id == cred_id).first()
    assert cred_db is not None
    assert "sk_live" not in cred_db.encrypted_data
    # Verify it can be safely decrypted by backend
    decrypted = decrypt_secret(cred_db.encrypted_data)
    assert "sk_live_very_secret_key_12345" in decrypted
