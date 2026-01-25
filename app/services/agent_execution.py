import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict

import httpx
from fastapi import Request, Response

from ..data.repository import DataRepository
from ..settings import settings
from ..supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

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


async def execute_agent_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    supabase = get_supabase_client()
    workflow_id = payload.get("workflowId")
    input_data = payload.get("input") or {}
    config = payload.get("config") or {}

    if not workflow_id:
        return {"error": "workflowId is required"}

    execution = (
        supabase.table("agent_executions")
        .insert(
            {
                "workflow_id": workflow_id,
                "session_id": input_data.get("session_id") or f"session-{int(time.time())}",
                "status": "running",
                "goal": config.get("goal"),
                "max_iterations": config.get("maxIterations") or 3,
                "reasoning_steps": [],
                "actions_taken": [],
                "current_state": input_data,
            }
        )
        .select()
        .single()
        .execute()
    ).data

    if not execution:
        return {"error": "Failed to create agent execution"}

    result_text = None
    try:
        if settings.ollama_base_url:
            url = settings.ollama_base_url.rstrip("/") + "/api/chat"
            prompt = input_data.get("message") or json.dumps(input_data)
            data_repo = DataRepository()
            system_prompt = data_repo.get_prompt_template(
                "agent_execution",
                variables={"goal": config.get("goal") or "Complete the task.", "input": json.dumps(input_data)},
            )
            if not system_prompt:
                system_prompt = config.get("goal") or "Complete the task."
            body = {
                "model": config.get("actionModel") or "llama3",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                "stream": False,
            }
            async with httpx.AsyncClient(timeout=settings.ollama_timeout_seconds) as client:
                resp = await client.post(url, json=body)
            resp.raise_for_status()
            data = resp.json()
            result_text = data.get("message", {}).get("content")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Agent model failed", extra={"error": str(exc)})

    result = result_text or input_data

    supabase.table("agent_executions").update(
        {
            "status": "completed",
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "final_output": result,
            "reasoning_steps": [],
            "actions_taken": [],
        }
    ).eq("id", execution["id"]).execute()

    return {
        "executionId": execution["id"],
        "status": "completed",
        "result": result,
        "reasoning": [],
        "actions": [],
        "iterations": 1,
    }


async def execute_agent(request: Request) -> Response:
    if request.method == "OPTIONS":
        return Response(headers=CORS_HEADERS)
    payload = await request.json()
    result = await execute_agent_payload(payload)
    if "error" in result:
        return _json_response({"error": result["error"]}, status=400)
    return _json_response(result)
