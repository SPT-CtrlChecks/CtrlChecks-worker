from fastapi.testclient import TestClient

from app.main import app


def test_chatbot_requires_message():
    client = TestClient(app)
    response = client.post("/chatbot", json={})
    assert response.status_code == 400


def test_chat_api_requires_workflow_id():
    client = TestClient(app)
    response = client.post("/chat-api", json={"message": "hello"})
    assert response.status_code == 400
