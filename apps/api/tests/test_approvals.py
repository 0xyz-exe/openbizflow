def test_human_approval_lifecycle(client):
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": "approvals@test.com", "password": "Password123!"},
    ).json()
    token = reg["access_token"]
    org_id = reg["current_organization_id"]

    # Trigger -> Approval -> Notification
    wf = client.post(
        "/api/v1/workflows/",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
        json={
            "name": "Expense Approval Flow",
            "definition": {
                "nodes": [
                    {"id": "t1", "type": "manual_trigger", "data": {"label": "Start"}},
                    {
                        "id": "appr1",
                        "type": "approval",
                        "data": {"label": "Manager Signoff", "prompt": "Approve purchase ${{trigger.payload.cost}}"},
                    },
                    {
                        "id": "notif1",
                        "type": "notification",
                        "data": {"label": "Notify", "title": "Done", "message": "Cleared"},
                    },
                ],
                "edges": [
                    {"id": "e1", "source": "t1", "target": "appr1"},
                    {"id": "e2", "source": "appr1", "target": "notif1"},
                ],
            },
        },
    ).json()

    # Execute workflow
    exec_res = client.post(
        f"/api/v1/workflows/{wf['id']}/execute",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
        json={"payload": {"cost": "450"}},
    ).json()

    # Verify execution pauses in WAITING status
    assert exec_res["status"] == "WAITING"
    exec_id = exec_res["id"]

    # Verify approval record is listed in Pending Approvals
    appr_list_res = client.get(
        "/api/v1/approvals/",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
    )
    assert appr_list_res.status_code == 200
    approvals = appr_list_res.json()
    assert len(approvals) >= 1
    target_appr = next(a for a in approvals if a["execution_id"] == exec_id)
    assert target_appr["status"] == "PENDING"
    assert "450" in target_appr["prompt"]

    # Approve request
    decide_res = client.post(
        f"/api/v1/approvals/{target_appr['id']}/decide",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
        json={"decision": "approve", "comments": "Approved by Finance lead."},
    )
    assert decide_res.status_code == 200
    resumed_exec = decide_res.json()
    assert resumed_exec["status"] == "SUCCEEDED"

    # Verify the downstream notification node executed
    nodes_map = {n["node_id"]: n["status"] for n in resumed_exec["node_executions"]}
    assert nodes_map["notif1"] == "SUCCEEDED"

    # Test rejection branch on a new execution
    exec_res2 = client.post(
        f"/api/v1/workflows/{wf['id']}/execute",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
        json={"payload": {"cost": "9999"}},
    ).json()
    assert exec_res2["status"] == "WAITING"

    approvals2 = client.get(
        "/api/v1/approvals/?status=PENDING",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
    ).json()
    target_appr2 = next(a for a in approvals2 if a["execution_id"] == exec_res2["id"])

    # Reject request
    decide_res2 = client.post(
        f"/api/v1/approvals/{target_appr2['id']}/decide",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
        json={"decision": "reject", "comments": "Over budget."},
    )
    assert decide_res2.status_code == 200
    rejected_exec = decide_res2.json()
    assert rejected_exec["status"] == "FAILED"
    assert "Over budget" in rejected_exec["error"]
