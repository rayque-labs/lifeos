from datetime import datetime, timedelta, timezone


def test_dashboard_aggregates_live_module_data(client):
    now = datetime.now(timezone.utc)
    today = now.date()
    yesterday_due = (now - timedelta(days=2)).isoformat()
    today_due = (now + timedelta(hours=2)).isoformat()
    overdue = client.post("/tasks/", json={"title": "Overdue task", "due_at": yesterday_due}).json()
    due_today = client.post("/tasks/", json={"title": "Today's task", "due_at": today_due}).json()

    project = client.post("/projects/", json={"title": "Dashboard project"}).json()
    project_task = client.post(
        "/tasks/", json={"title": "Project task", "project_id": project["id"]}
    ).json()
    client.patch(f"/tasks/{project_task['id']}", json={"completed": True})

    habit = client.post("/habits/", json={"name": "Meditate"}).json()
    client.post(f"/habits/{habit['id']}/logs", json={"logged_on": str(today)})

    event = client.post(
        "/calendar/events/",
        json={"title": "Upcoming", "starts_at": (now + timedelta(hours=3)).isoformat(),
              "ends_at": (now + timedelta(hours=4)).isoformat()},
    )
    assert event.status_code == 201

    account = client.post("/finance/accounts", json={"name": "Dashboard wallet", "currency": "USD"}).json()
    client.post(
        "/finance/transactions",
        json={"account_id": account["id"], "kind": "income", "title": "Income", "amount": "12.34",
              "occurred_on": str(today)},
    )

    response = client.get("/dashboard/")
    assert response.status_code == 200
    data = response.json()
    assert data["tasks"]["overdue"] == 1
    assert data["tasks"]["due_today"] == 1
    assert data["tasks"]["total"] == 3
    assert data["projects"]["active"] == 1
    assert data["projects"]["average_progress"] == 100.0
    assert data["habits_today"][0]["checked_in_today"] is True
    assert [item["id"] for item in data["upcoming_events"]] == [event.json()["id"]]
    assert data["finance"]["monthly"]["currencies"][0]["income"] == "12.34"


def test_dashboard_data_is_scoped_to_current_user(client):
    client.post("/tasks/", json={"title": "Private"})
    client.post(
        "/auth/register",
        json={"email": "dashboard-other@example.com", "full_name": "Other User", "password": "another-password-123"},
    )
    login = client.post(
        "/auth/login", json={"email": "dashboard-other@example.com", "password": "another-password-123"}
    )
    client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"

    data = client.get("/dashboard/").json()
    assert data["tasks"]["total"] == 0
    assert data["projects"]["active"] == 0
    assert data["habits_today"] == []
    assert data["upcoming_events"] == []
    assert data["finance"]["accounts"] == []
    assert data["finance"]["monthly"]["currencies"] == []
