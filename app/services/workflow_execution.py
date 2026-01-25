import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import Request, Response

from ..settings import settings
from ..supabase_client import get_supabase_client

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}


def _json_response(payload: Dict[str, Any], status: int = 200) -> Response:
    return Response(
        content=json.dumps(payload),
        status_code=status,
        media_type="application/json",
        headers=CORS_HEADERS,
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_logs(node_id: str, node_name: str, status: str, input_data: Any, output: Any, error: Optional[str]) -> Dict[str, Any]:
    return {
        "nodeId": node_id,
        "nodeName": node_name,
        "status": status,
        "startedAt": _now_iso(),
        "finishedAt": _now_iso(),
        "input": input_data,
        "output": output,
        "error": error,
    }


async def execute_workflow_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    supabase = get_supabase_client()
    workflow_id = payload.get("workflowId")
    execution_id = payload.get("executionId")
    input_data = payload.get("input") or {}

    if not workflow_id:
        return {"error": "workflowId is required", "status": "failed"}

    workflow = (
        supabase.table("workflows").select("*").eq("id", workflow_id).single().execute()
    ).data
    if not workflow:
        return {"error": "Workflow not found", "status": "failed"}

    nodes = workflow.get("nodes") or []
    edges = workflow.get("edges") or []

    if execution_id:
        execution = (
            supabase.table("executions")
            .select("*")
            .eq("id", execution_id)
            .single()
            .execute()
        ).data
        if not execution:
            return {"error": "Execution not found", "status": "failed"}
        supabase.table("executions").update({"status": "running"}).eq("id", execution_id).execute()
    else:
        execution = (
            supabase.table("executions")
            .insert(
                {
                    "workflow_id": workflow_id,
                    "user_id": workflow.get("user_id"),
                    "status": "running",
                    "trigger": "manual",
                    "input": input_data,
                    "logs": [],
                }
            )
            .select()
            .single()
            .execute()
        ).data
        execution_id = execution["id"]

    form_node = next((n for n in nodes if (n.get("data", {}).get("type") or n.get("type")) == "form"), None)
    if form_node and not payload.get("executionId"):
        has_form_data = isinstance(input_data, dict) and (
            "data" in input_data or "submitted_at" in input_data or "form_id" in input_data
        )
        if not has_form_data:
            supabase.table("executions").update(
                {"status": "waiting", "trigger": "form", "waiting_for_node_id": form_node.get("id")}
            ).eq("id", execution_id).execute()
            base_url = settings.public_base_url.rstrip("/")
            form_path = f"/form-trigger/{workflow_id}/{form_node.get('id')}"
            form_url = f"{base_url}{form_path}" if base_url else form_path
            return {
                "status": "waiting",
                "executionId": execution_id,
                "message": "Workflow is waiting for form submission",
                "formUrl": form_url,
            }

    logs: List[Dict[str, Any]] = []
    start_time = time.time()
    output = input_data
    for node in nodes:
        node_id = node.get("id", "node")
        node_type = node.get("data", {}).get("type") or node.get("type") or "node"
        node_label = node.get("data", {}).get("label") or node_type
        log = _build_logs(node_id, node_label, "success", output, output, None)
        logs.append(log)

    duration_ms = int((time.time() - start_time) * 1000)
    supabase.table("executions").update(
        {
            "status": "success",
            "finished_at": _now_iso(),
            "duration_ms": duration_ms,
            "output": output,
            "logs": logs,
        }
    ).eq("id", execution_id).execute()

    return {
        "executionId": execution_id,
        "status": "success",
        "output": output,
        "logs": logs,
        "durationMs": duration_ms,
    }


async def execute_workflow(request: Request) -> Response:
    if request.method == "OPTIONS":
        return Response(headers=CORS_HEADERS)
    payload = await request.json()
    result = await execute_workflow_payload(payload)
    status = 200 if result.get("status") not in {"failed"} else 500
    if result.get("error") == "workflowId is required":
        status = 400
    if result.get("error") == "Workflow not found":
        status = 404
    return _json_response(result, status=status)


async def execute_node(request: Request) -> Response:
    if request.method == "OPTIONS":
        return Response(headers=CORS_HEADERS)
    payload = await request.json()
    node_id = payload.get("nodeId")
    node_type = payload.get("nodeType")
    config = payload.get("config") or {}
    if not node_id or not node_type:
        return _json_response({"error": "nodeId, nodeType, and config are required"}, status=400)
    start_time = time.time()
    output = payload.get("input") or {}
    log = f"Executed node {node_id} ({node_type})"
    return _json_response(
        {
            "success": True,
            "output": output,
            "logs": [log],
            "executionTime": int((time.time() - start_time) * 1000),
        }
    )
