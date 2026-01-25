from typing import Any, Dict

import pytest
from fastapi.testclient import TestClient

from app.main import app


class _Result:
    def __init__(self, data=None, count=None):
        self.data = data
        self.count = count


class _Table:
    def __init__(self, store: Dict[str, Dict[str, Any]], name: str):
        self._store = store
        self._name = name
        self._filters = {}
        self._insert_payload = None

    def select(self, *args, **kwargs):
        return self

    def eq(self, key, value):
        self._filters[key] = value
        return self

    def single(self):
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def insert(self, payload):
        self._insert_payload = payload
        return self

    def execute(self):
        if self._insert_payload:
            if isinstance(self._insert_payload, list):
                item = self._insert_payload[0]
            else:
                item = self._insert_payload
            self._store.setdefault(self._name, {})[item["id"]] = item
            return _Result(item)
        table = self._store.get(self._name, {})
        item = None
        if "id" in self._filters:
            item = table.get(self._filters["id"])
        return _Result(item)


class _Supabase:
    def __init__(self, store):
        self._store = store

    def table(self, name: str):
        return _Table(self._store, name)

    class auth:
        @staticmethod
        def get_user(token):
            return type("UserResp", (), {"user": None})


def test_health_ok():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_generate_workflow_requires_prompt():
    client = TestClient(app)
    response = client.post("/generate-workflow", json={"prompt": ""})
    assert response.status_code == 400


def test_workflow_status_contract(monkeypatch):
    store = {"workflow_generation_jobs": {"job_1": {"id": "job_1", "status": "completed", "progress_percentage": 100}}}
    monkeypatch.setattr("app.supabase_client.get_supabase_client", lambda: _Supabase(store))
    client = TestClient(app)
    response = client.get("/workflow-status/job_1")
    assert response.status_code == 200
    data = response.json()
    assert data["job_id"] == "job_1"
    assert data["status"] == "completed"
