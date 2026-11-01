from datetime import datetime, timedelta, timezone


def test_habit_logs_are_idempotent_and_metrics_use_real_history(client):
    habit = client.post("/habits/", json={"name": "Read", "frequency": "daily"})
    assert habit.status_code == 201
    habit_id = habit.json()["id"]
    today = datetime.now(timezone.utc).date()

    client.post(f"/habits/{habit_id}/logs", json={"logged_on": str(today - timedelta(days=1)), "note": "Yesterday"})
    first = client.post(f"/habits/{habit_id}/logs", json={"logged_on": str(today), "note": "First"})
    second = client.post(f"/habits/{habit_id}/logs", json={"logged_on": str(today), "note": "Updated"})
    assert first.status_code == second.status_code == 200
    assert first.json()["id"] == second.json()["id"]

    result = client.get(f"/habits/{habit_id}").json()
    assert result["current_streak"] == 2
    assert result["log_count_30_days"] == 2
    assert result["consistency_percentage"] == 6.7
    history = client.get(f"/habits/{habit_id}/logs").json()
    assert len(history) == 2
    assert history[0]["note"] == "Updated"


def test_weekly_habit_frequency_and_validation(client):
    created = client.post("/habits/", json={"name": "Workout", "frequency": "weekly", "target_per_week": 3})
    assert created.status_code == 201
    assert created.json()["target_per_week"] == 3
    invalid = client.post("/habits/", json={"name": "Bad daily", "frequency": "daily", "target_per_week": 2})
    assert invalid.status_code == 422


def test_habits_and_logs_are_private_to_the_owner(client):
    habit = client.post("/habits/", json={"name": "Private habit"}).json()
    assert client.post(
        "/auth/register",
        json={"email": "habit-other@example.com", "full_name": "Other User", "password": "another-password-123"},
    ).status_code == 201
    login = client.post(
        "/auth/login", json={"email": "habit-other@example.com", "password": "another-password-123"}
    )
    client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"

    assert client.get("/habits/").json() == []
    assert client.get(f"/habits/{habit['id']}").status_code == 404
    assert client.post(f"/habits/{habit['id']}/logs", json={"logged_on": "2026-01-01"}).status_code == 404
    assert client.delete(f"/habits/{habit['id']}").status_code == 404
