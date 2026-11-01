def test_project_progress_tracks_owned_tasks(client):
    project = client.post(
        "/projects/",
        json={"title": "Home renovation", "objective": "Finish the kitchen", "deadline": "2026-12-31"},
    )
    assert project.status_code == 201
    project_data = project.json()
    assert project_data["progress"] == 0.0
    assert project_data["total_tasks"] == 0

    first = client.post("/tasks/", json={"title": "Buy paint", "project_id": project_data["id"]})
    second = client.post("/tasks/", json={"title": "Install cabinets", "project_id": project_data["id"]})
    assert first.status_code == second.status_code == 201
    client.patch(f"/tasks/{first.json()['id']}", json={"completed": True})

    updated = client.get(f"/projects/{project_data['id']}").json()
    assert updated["total_tasks"] == 2
    assert updated["completed_tasks"] == 1
    assert updated["progress"] == 50.0


def test_project_routes_and_linked_tasks_are_isolated(client):
    project = client.post("/projects/", json={"title": "Private project"}).json()
    assert client.post(
        "/auth/register",
        json={"email": "project-other@example.com", "full_name": "Other User", "password": "another-password-123"},
    ).status_code == 201
    login = client.post(
        "/auth/login", json={"email": "project-other@example.com", "password": "another-password-123"}
    )
    client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"

    assert client.get("/projects/").json() == []
    assert client.get(f"/projects/{project['id']}").status_code == 404
    assert client.patch(f"/projects/{project['id']}", json={"title": "stolen"}).status_code == 404
    assert client.delete(f"/projects/{project['id']}").status_code == 404
    assert client.post("/tasks/", json={"title": "Cross-account link", "project_id": project["id"]}).status_code == 404


def test_deleting_project_unlinks_existing_tasks(client):
    project = client.post("/projects/", json={"title": "Temporary project"}).json()
    task = client.post("/tasks/", json={"title": "Unlink me", "project_id": project["id"]}).json()
    response = client.delete(f"/projects/{project['id']}")
    assert response.status_code == 204
    assert client.get(f"/tasks/{task['id']}").json()["project_id"] is None
