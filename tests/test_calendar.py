def test_calendar_event_crud_range_and_task_link(client):
    task = client.post("/tasks/", json={"title": "Prepare presentation"}).json()
    created = client.post(
        "/calendar/events/",
        json={"title": "Presentation", "description": "Quarterly review", "starts_at": "2026-12-10T10:00:00-03:00",
              "ends_at": "2026-12-10T11:00:00-03:00", "task_id": task["id"]},
    )
    assert created.status_code == 201
    event = created.json()
    assert event["task_id"] == task["id"]

    in_range = client.get("/calendar/events/", params={"starts_after": "2026-12-10T00:00:00Z",
                                                        "starts_before": "2026-12-11T00:00:00Z"})
    assert [item["id"] for item in in_range.json()] == [event["id"]]
    assert client.get("/calendar/events/", params={"starts_after": "2026-12-11T00:00:00Z"}).json() == []

    updated = client.patch(f"/calendar/events/{event['id']}", json={"title": "Moved presentation"})
    assert updated.status_code == 200
    assert updated.json()["title"] == "Moved presentation"
    assert client.delete(f"/calendar/events/{event['id']}").status_code == 204


def test_calendar_rejects_invalid_times_and_cross_user_links(client):
    invalid = client.post(
        "/calendar/events/",
        json={"title": "Invalid", "starts_at": "2026-12-10T11:00:00Z", "ends_at": "2026-12-10T10:00:00Z"},
    )
    assert invalid.status_code == 422

    task = client.post("/tasks/", json={"title": "Private task"}).json()
    client.post(
        "/auth/register",
        json={"email": "calendar-other@example.com", "full_name": "Other User", "password": "another-password-123"},
    )
    login = client.post(
        "/auth/login", json={"email": "calendar-other@example.com", "password": "another-password-123"}
    )
    client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"

    linked = client.post(
        "/calendar/events/",
        json={"title": "Cross account", "starts_at": "2026-12-10T10:00:00Z", "ends_at": "2026-12-10T11:00:00Z",
              "task_id": task["id"]},
    )
    assert linked.status_code == 404
    assert client.get("/calendar/events/").json() == []


def test_calendar_events_are_isolated_between_users(client):
    event = client.post(
        "/calendar/events/",
        json={
            "title": "Private event",
            "starts_at": "2026-12-10T10:00:00Z",
            "ends_at": "2026-12-10T11:00:00Z"
        }
    ).json()

    register = client.post(
        "/auth/register",
        json={
            "email": "event-other@example.com",
            "full_name": "Other User",
            "password": "another-password-123"
        }
    )
    assert register.status_code == 201

    login = client.post(
        "/auth/login",
        json={
            "email": "event-other@example.com",
            "password": "another-password-123"
        }
    )

    client.headers["Authorization"] = (
        f"Bearer {login.json()['access_token']}"
    )

    assert client.get("/calendar/events/").json() == []

    assert client.get(
        f"/calendar/events/{event['id']}"
    ).status_code == 404

    assert client.patch(
        f"/calendar/events/{event['id']}",
        json={"title": "Unauthorized modification"}
    ).status_code == 404

    assert client.delete(
        f"/calendar/events/{event['id']}"
    ).status_code == 404
