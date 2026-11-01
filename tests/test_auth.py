def test_registration_normalizes_email_and_never_returns_password(client):
    response = client.post(
        "/auth/register",
        json={"email": " NewUser@Example.com ", "full_name": "New User", "password": "secure-password-123"},
    )

    assert response.status_code == 201
    assert response.json()["email"] == "newuser@example.com"
    assert "password" not in response.json()
    assert "password_hash" not in response.json()


def test_password_recovery_uses_single_use_token_without_exposing_it(client, monkeypatch):
    from app.services import email_service

    sent = {}
    monkeypatch.setattr(email_service, "is_configured", lambda: True)
    monkeypatch.setattr(email_service, "send_password_reset_email", lambda email, token: sent.update(token=token))

    existing = client.post("/auth/password-reset/request", json={"email": "owner@example.com"})
    missing = client.post("/auth/password-reset/request", json={"email": "missing@example.com"})
    assert existing.status_code == missing.status_code == 202
    assert existing.json() == missing.json()
    assert "token" not in existing.json()

    reset = client.post(
        "/auth/password-reset/confirm",
        json={"token": sent["token"], "new_password": "reset-secure-password-123"},
    )
    assert reset.status_code == 200
    assert client.post(
        "/auth/password-reset/confirm",
        json={"token": sent["token"], "new_password": "another-secure-password-123"},
    ).status_code == 400
    assert client.post(
        "/auth/login", json={"email": "owner@example.com", "password": "reset-secure-password-123"}
    ).status_code == 200


def test_password_recovery_requires_email_configuration(client, monkeypatch):
    from app.services import email_service

    monkeypatch.setattr(email_service, "is_configured", lambda: False)
    response = client.post("/auth/password-reset/request", json={"email": "missing@example.com"})
    assert response.status_code == 503


def test_duplicate_email_is_rejected(client):
    response = client.post(
        "/auth/register",
        json={"email": "OWNER@example.com", "full_name": "Duplicate", "password": "secure-password-123"},
    )

    assert response.status_code == 409


def test_login_profile_and_logout_revoke_tokens(client):
    login = client.post(
        "/auth/login", json={"email": "owner@example.com", "password": "test-password-123"}
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    client.headers["Authorization"] = f"Bearer {token}"
    assert client.get("/auth/me").json()["email"] == "owner@example.com"
    assert client.post("/auth/logout").status_code == 204
    assert client.get("/auth/me").status_code == 401


def test_invalid_password_and_unauthenticated_task_access_are_rejected(client):
    login = client.post(
        "/auth/login", json={"email": "owner@example.com", "password": "wrong-password"}
    )
    assert login.status_code == 401

    client.headers.pop("Authorization")
    assert client.get("/tasks/").status_code == 401


def test_profile_and_password_can_be_updated(client):
    updated = client.patch("/auth/me", json={"full_name": "Updated Owner"})
    assert updated.status_code == 200
    assert updated.json()["full_name"] == "Updated Owner"

    response = client.put(
        "/auth/password",
        json={"current_password": "test-password-123", "new_password": "new-secure-password-123"},
    )
    assert response.status_code == 204
    assert client.get("/auth/me").status_code == 401

    login = client.post(
        "/auth/login", json={"email": "owner@example.com", "password": "new-secure-password-123"}
    )
    assert login.status_code == 200


def test_users_cannot_access_another_users_tasks(client):
    created = client.post("/tasks/", json={"title": "Private task"})
    task_id = created.json()["id"]

    assert client.post(
        "/auth/register",
        json={"email": "other@example.com", "full_name": "Other User", "password": "another-password-123"},
    ).status_code == 201
    login = client.post(
        "/auth/login", json={"email": "other@example.com", "password": "another-password-123"}
    )
    client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"

    assert client.get("/tasks/").json() == []
    assert client.get(f"/tasks/{task_id}").status_code == 404
    assert client.put(f"/tasks/{task_id}", json={"title": "stolen"}).status_code == 404
    assert client.delete(f"/tasks/{task_id}").status_code == 404


def test_expired_password_reset_token_is_rejected(client, monkeypatch):
    from datetime import datetime, timedelta, timezone

    from app.models.password_reset_token import PasswordResetToken
    from app.services import auth_service, email_service

    sent = {}
    monkeypatch.setattr(email_service, "is_configured", lambda: True)
    monkeypatch.setattr(
        email_service,
        "send_password_reset_email",
        lambda email, token: sent.update(token=token),
    )

    response = client.post(
        "/auth/password-reset/request",
        json={"email": "owner@example.com"},
    )
    assert response.status_code == 202

    # Obtém a sessão de teste através da dependência do FastAPI.
    db = client.app.state.TestingSessionLocal()

    try:
        reset = auth_service.get_password_reset(db, sent["token"])
        assert reset is not None

        reset.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
    finally:
        db.close()

    response = client.post(
        "/auth/password-reset/confirm",
        json={
            "token": sent["token"],
            "new_password": "new-secure-password-123",
        },
    )

    assert response.status_code == 400
