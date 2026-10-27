import pytest
from app.workflow_engine.validator import validate_workflow_graph
from app.workflow_engine.ssrf import validate_url_safe

def test_dag_cycle_detection():
    # A -> B -> C -> A (Cycle)
    definition = {
        "nodes": [
            {"id": "node_a", "type": "manual_trigger", "data": {}},
            {"id": "node_b", "type": "transform", "data": {}},
            {"id": "node_c", "type": "log", "data": {}},
        ],
        "edges": [
            {"id": "e1", "source": "node_a", "target": "node_b"},
            {"id": "e2", "source": "node_b", "target": "node_c"},
            {"id": "e3", "source": "node_c", "target": "node_a"},
        ],
    }
    res = validate_workflow_graph(definition)
    assert res["is_valid"] is False
    assert any("Cycle detected" in err for err in res["errors"])

def test_ssrf_protection():
    with pytest.raises(ValueError, match="SSRF Protection"):
        validate_url_safe("http://127.0.0.1:8000/internal")

    with pytest.raises(ValueError, match="SSRF Protection"):
        validate_url_safe("http://169.254.169.254/latest/meta-data/")

    with pytest.raises(ValueError, match="Unsupported URL scheme"):
        validate_url_safe("file:///etc/passwd")

def test_linear_workflow_execution(client):
    # Register user
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": "linear@test.com", "password": "Password123!"},
    ).json()
    token = reg["access_token"]
    org_id = reg["current_organization_id"]

    # Create workflow: Manual Trigger -> Transform -> Log
    wf = client.post(
        "/api/v1/workflows/",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
        json={
            "name": "Linear Test",
            "definition": {
                "nodes": [
                    {"id": "t1", "type": "manual_trigger", "data": {"label": "Start"}},
                    {
                        "id": "tr1",
                        "type": "transform",
                        "data": {
                            "label": "Double",
                            "mapping": {
                                "client_name": "{{trigger.payload.name}}",
                                "status": "processed",
                            },
                        },
                    },
                    {"id": "l1", "type": "log", "data": {"label": "Log", "message": "Done: {{nodes.tr1.output.client_name}}"}},
                ],
                "edges": [
                    {"id": "e1", "source": "t1", "target": "tr1"},
                    {"id": "e2", "source": "tr1", "target": "l1"},
                ],
            },
        },
    ).json()

    # Execute workflow manually
    exec_res = client.post(
        f"/api/v1/workflows/{wf['id']}/execute",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
        json={"payload": {"name": "Alice"}},
    )
    assert exec_res.status_code == 200, exec_res.text
    exec_data = exec_res.json()
    assert exec_data["status"] == "SUCCEEDED"
    assert len(exec_data["node_executions"]) == 3

    # Check node execution outputs
    tr_node = next(n for n in exec_data["node_executions"] if n["node_id"] == "tr1")
    assert tr_node["output_data"]["client_name"] == "Alice"
    assert tr_node["output_data"]["status"] == "processed"

    log_node = next(n for n in exec_data["node_executions"] if n["node_id"] == "l1")
    assert "Done: Alice" in log_node["output_data"]["message"]

def test_conditional_branching_execution(client):
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": "cond@test.com", "password": "Password123!"},
    ).json()
    token = reg["access_token"]
    org_id = reg["current_organization_id"]

    # Condition: amount > 50 -> high_branch (true) or low_branch (false)
    wf = client.post(
        "/api/v1/workflows/",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
        json={
            "name": "Branch Test",
            "definition": {
                "nodes": [
                    {"id": "t1", "type": "manual_trigger", "data": {"label": "Start"}},
                    {
                        "id": "c1",
                        "type": "condition",
                        "data": {
                            "label": "Check Amount",
                            "left_operand": "{{trigger.payload.amount}}",
                            "operator": "gt",
                            "right_operand": "50",
                        },
                    },
                    {"id": "high_log", "type": "log", "data": {"label": "High Amount", "message": "HIGH"}},
                    {"id": "low_log", "type": "log", "data": {"label": "Low Amount", "message": "LOW"}},
                ],
                "edges": [
                    {"id": "e1", "source": "t1", "target": "c1"},
                    {"id": "e2", "source": "c1", "target": "high_log", "sourceHandle": "true"},
                    {"id": "e3", "source": "c1", "target": "low_log", "sourceHandle": "false"},
                ],
            },
        },
    ).json()

    # Run with amount = 100 -> Expect high_log to SUCCEED and low_log to be SKIPPED
    res100 = client.post(
        f"/api/v1/workflows/{wf['id']}/execute",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
        json={"payload": {"amount": "100"}},
    ).json()

    assert res100["status"] == "SUCCEEDED"
    nodes100 = {n["node_id"]: n["status"] for n in res100["node_executions"]}
    assert nodes100["high_log"] == "SUCCEEDED"
    assert nodes100["low_log"] == "SKIPPED"

    # Run with amount = 20 -> Expect low_log to SUCCEED and high_log to be SKIPPED
    res20 = client.post(
        f"/api/v1/workflows/{wf['id']}/execute",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
        json={"payload": {"amount": "20"}},
    ).json()

    assert res20["status"] == "SUCCEEDED"
    nodes20 = {n["node_id"]: n["status"] for n in res20["node_executions"]}
    assert nodes20["high_log"] == "SKIPPED"
    assert nodes20["low_log"] == "SUCCEEDED"
