def test_tenant_isolation_cross_access_denied(client):
    # User 1 / Org 1
    u1_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "user1@orgone.com",
            "password": "Password123!",
            "organization_name": "Org One",
        },
    )
    token1 = u1_res.json()["access_token"]
    org1_id = u1_res.json()["current_organization_id"]

    # User 2 / Org 2
    u2_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "user2@orgtwo.com",
            "password": "Password123!",
            "organization_name": "Org Two",
        },
    )
    token2 = u2_res.json()["access_token"]
    org2_id = u2_res.json()["current_organization_id"]

    # User 1 creates workflow in Org 1
    wf_res = client.post(
        "/api/v1/workflows/",
        headers={"Authorization": f"Bearer {token1}", "X-Organization-Id": org1_id},
        json={
            "name": "Secret Org1 Workflow",
            "definition": {
                "nodes": [
                    {"id": "t1", "type": "manual_trigger", "data": {"label": "Start"}}
                ],
                "edges": [],
            },
        },
    )
    assert wf_res.status_code == 200
    wf1_id = wf_res.json()["id"]

    # User 2 tries to access Org 1 with X-Organization-Id header
    cross_hdr_res = client.get(
        "/api/v1/workflows/",
        headers={"Authorization": f"Bearer {token2}", "X-Organization-Id": org1_id},
    )
    assert cross_hdr_res.status_code == 403

    # User 2 tries to access Org 1 workflow directly
    cross_wf_res = client.get(
        f"/api/v1/workflows/{wf1_id}",
        headers={"Authorization": f"Bearer {token2}", "X-Organization-Id": org2_id},
    )
    assert cross_wf_res.status_code == 404

    # User 2 tries to read Org 1 members
    cross_mem_res = client.get(
        f"/api/v1/organizations/{org1_id}/members",
        headers={"Authorization": f"Bearer {token2}", "X-Organization-Id": org2_id},
    )
    assert cross_mem_res.status_code == 403
