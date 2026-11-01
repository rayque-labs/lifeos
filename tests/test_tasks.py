def test_home(client):
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["project"] == "LifeOS"


def test_health(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_create_task(client):
    response = client.post(
        "/tasks/",
        json={
            "title": "Estudar Python",
            "description": "Criar testes automatizados",
            "priority": "high"
        }
    )

    assert response.status_code == 201

    data = response.json()

    assert data["title"] == "Estudar Python"
    assert data["priority"] == "high"
    assert data["completed"] is False


def test_invalid_priority(client):
    response = client.post(
        "/tasks/",
        json={
            "title": "Teste inválido",
            "priority": "absurda"
        }
    )

    assert response.status_code == 422


def test_list_tasks(client):
    client.post(
        "/tasks/",
        json={"title": "Tarefa para listar"}
    )

    response = client.get("/tasks/")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["title"] == "Tarefa para listar"


def test_update_task(client):
    created = client.post(
        "/tasks/",
        json={"title": "Tarefa original"}
    )

    task_id = created.json()["id"]

    response = client.put(
        f"/tasks/{task_id}",
        json={
            "title": "Tarefa atualizada",
            "completed": True
        }
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Tarefa atualizada"
    assert response.json()["completed"] is True


def test_delete_task(client):
    created = client.post(
        "/tasks/",
        json={"title": "Tarefa para excluir"}
    )

    task_id = created.json()["id"]

    response = client.delete(f"/tasks/{task_id}")

    assert response.status_code == 204

    check = client.get(f"/tasks/{task_id}")

    assert check.status_code == 404


def test_get_nonexistent_task(client):
    response = client.get("/tasks/999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Task not found"


def test_update_nonexistent_task(client):
    response = client.put(
        "/tasks/999",
        json={"title": "Tarefa inexistente"}
    )

    assert response.status_code == 404


def test_delete_nonexistent_task(client):
    response = client.delete("/tasks/999")

    assert response.status_code == 404


def test_create_task_without_title(client):
    response = client.post(
        "/tasks/",
        json={"priority": "high"}
    )

    assert response.status_code == 422


def test_task_filters_search_and_sort(client):
    first = client.post(
        "/tasks/",
        json={"title": "Dentist appointment", "description": "annual checkup", "category": "health",
              "priority": "high", "due_at": "2026-12-10T10:00:00Z"},
    ).json()
    client.post(
        "/tasks/",
        json={"title": "Buy groceries", "category": "home", "priority": "low",
              "due_at": "2026-12-01T10:00:00Z"},
    )

    response = client.get("/tasks/", params={"q": "annual", "category": "health"})
    assert [task["id"] for task in response.json()] == [first["id"]]

    sorted_tasks = client.get("/tasks/", params={"sort_by": "due_at", "sort_order": "asc"}).json()
    assert [task["title"] for task in sorted_tasks] == ["Buy groceries", "Dentist appointment"]


def test_task_status_and_recurring_completion_create_next_occurrence(client):
    created = client.post(
        "/tasks/",
        json={"title": "Monthly review", "category": "work", "due_at": "2026-01-31T09:00:00Z",
              "recurrence_rule": "monthly"},
    )
    assert created.status_code == 201
    task_id = created.json()["id"]

    completed = client.put(f"/tasks/{task_id}", json={"status": "completed"})
    assert completed.status_code == 200
    assert completed.json()["completed"] is True

    tasks = client.get("/tasks/").json()
    follow_up = next(task for task in tasks if task["parent_task_id"] == task_id)
    assert follow_up["status"] == "pending"
    assert follow_up["completed"] is False
    assert follow_up["due_at"].startswith("2026-02-28T09:00:00")


def test_recurring_task_requires_due_date_and_invalid_sort_is_rejected(client):
    invalid_task = client.post("/tasks/", json={"title": "Recurring", "recurrence_rule": "weekly"})
    assert invalid_task.status_code == 422
    assert client.get("/tasks/", params={"sort_by": "user_id"}).status_code == 422


def test_tasks_are_isolated_between_users(client):
    task = client.post(
        "/tasks/",
        json={"title": "Private task"}
    ).json()

    register = client.post(
        "/auth/register",
        json={
            "email": "task-other@example.com",
            "full_name": "Other User",
            "password": "another-password-123"
        }
    )
    assert register.status_code == 201

    login = client.post(
        "/auth/login",
        json={
            "email": "task-other@example.com",
            "password": "another-password-123"
        }
    )

    client.headers["Authorization"] = (
        f"Bearer {login.json()['access_token']}"
    )

    assert client.get("/tasks/").json() == []
    assert client.get(f"/tasks/{task['id']}").status_code == 404

    assert client.patch(
        f"/tasks/{task['id']}",
        json={"title": "Unauthorized modification"}
    ).status_code == 404

    assert client.delete(
        f"/tasks/{task['id']}"
    ).status_code == 404
