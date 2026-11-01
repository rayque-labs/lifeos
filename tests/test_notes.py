def test_note_create_search_tags_pin_and_update(client):
    first = client.post(
        "/notes/",
        json={"title": "Meeting notes", "content": "Discuss quarterly launch", "category": "work",
              "tags": ["Launch", "Team", "launch"], "pinned": True},
    )
    assert first.status_code == 201
    assert first.json()["tags"] == ["launch", "team"]

    client.post("/notes/", json={"title": "Shopping", "content": "Milk and bread", "category": "home"})
    result = client.get("/notes/", params={"q": "quarterly", "tag": "launch", "pinned": True})
    assert [note["id"] for note in result.json()] == [first.json()["id"]]

    updated = client.patch(f"/notes/{first.json()['id']}", json={"pinned": False, "title": "Project notes"})
    assert updated.status_code == 200
    assert updated.json()["title"] == "Project notes"
    unpinned = client.get("/notes/", params={"pinned": False}).json()
    assert unpinned[0]["title"] == "Project notes"
    assert {note["title"] for note in unpinned} == {"Project notes", "Shopping"}


def test_notes_are_isolated_and_deletable(client):
    note = client.post("/notes/", json={"title": "Secret", "content": "Private content"}).json()
    client.post(
        "/auth/register",
        json={"email": "notes-other@example.com", "full_name": "Other User", "password": "another-password-123"},
    )
    login = client.post("/auth/login", json={"email": "notes-other@example.com", "password": "another-password-123"})
    client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"

    assert client.get("/notes/").json() == []
    assert client.get(f"/notes/{note['id']}").status_code == 404
    assert client.patch(f"/notes/{note['id']}", json={"title": "stolen"}).status_code == 404
    assert client.delete(f"/notes/{note['id']}").status_code == 404
