def test_register_and_login(client):
    # Register User
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "sarah@example.com",
            "password": "Password123!",
            "full_name": "Sarah Connor",
            "organization_name": "Resistance HQ",
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "sarah@example.com"
    token = data["access_token"]
    org_id = data["current_organization_id"]
    assert org_id

    # Duplicate register rejected
    dup_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "sarah@example.com",
            "password": "Password123!",
        },
    )
    assert dup_res.status_code == 400

    # Login
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "sarah@example.com", "password": "Password123!"},
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

    # Invalid password
    bad_res = client.post(
        "/api/v1/auth/login",
        json={"email": "sarah@example.com", "password": "wrongpassword"},
    )
    assert bad_res.status_code == 401

    # Me endpoint
    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["user"]["email"] == "sarah@example.com"
    assert len(me_data["organizations"]) >= 1
    assert me_data["organizations"][0]["role"] == "owner"
