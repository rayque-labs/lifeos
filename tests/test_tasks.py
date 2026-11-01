from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


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
