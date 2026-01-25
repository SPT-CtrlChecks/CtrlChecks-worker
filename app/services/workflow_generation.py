import json
import logging
import random
from datetime import datetime, timezone
from typing import Any, Dict, Iterable

import httpx
from fastapi import Request, Response
from fastapi.responses import StreamingResponse

from ..data.repository import DataRepository
from ..settings import settings
from ..supabase_client import get_supabase_client
from ..utils.retries import retry_configured

logger = logging.getLogger(__name__)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "true",
}


def _json_response(payload: Dict[str, Any], status: int = 200) -> Response:
    return Response(
        content=json.dumps(payload),
        status_code=status,
        media_type="application/json",
        headers=CORS_HEADERS,
    )


def _extract_prompt(payload: Dict[str, Any]) -> str:
    prompt = payload.get("prompt") or payload.get("description") or ""
    return prompt.strip()


async def _call_ollama(prompt: str, system_prompt: str) -> Dict[str, Any]:
    url = settings.ollama_base_url.rstrip("/") + "/api/chat"
    payload = {
        "model": "llama3",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
    }
    timeout = httpx.Timeout(settings.ollama_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, json=payload)
    response.raise_for_status()
    data = response.json()
    content = data.get("message", {}).get("content") or ""
    return {"raw": content}


def _fallback_workflow(prompt: str) -> Dict[str, Any]:
    return {
        "nodes": [
            {
                "id": "trigger",
                "type": "trigger",
                "position": {"x": 200, "y": 100},
                "data": {"label": "Trigger", "type": "trigger", "category": "trigger", "config": {}},
            },
            {
                "id": "action",
                "type": "action",
                "position": {"x": 500, "y": 100},
                "data": {"label": "Action", "type": "action", "category": "action", "config": {"prompt": prompt}},
            },
        ],
        "edges": [{"id": "edge-1", "source": "trigger", "target": "action"}],
        "explanation": "Generated a minimal workflow from the prompt.",
        "status": "completed",
    }


async def _generate_workflow_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    prompt = _extract_prompt(payload)
    if not prompt:
        raise ValueError("Prompt is required and must be a non-empty string")
    data_repo = DataRepository()
    reference_guide = data_repo.get_node_reference()
    system_prompt = data_repo.get_prompt_template(
        "workflow_generation",
        variables={"reference_guide": reference_guide, "user_prompt": prompt},
    )
    if not system_prompt:
        system_prompt = "Return JSON with keys: nodes, edges, explanation."
    try:
        llm = await _call_ollama(prompt, system_prompt)
        raw = llm.get("raw", "").strip()
        if raw:
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return _fallback_workflow(prompt)
        return _fallback_workflow(prompt)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Workflow generation fallback", extra={"error": str(exc)})
        return _fallback_workflow(prompt)


async def generate_workflow(request: Request) -> Response:
    if request.method == "OPTIONS":
        return Response(headers=CORS_HEADERS)

    try:
        payload = await request.json()
    except Exception as exc:  # noqa: BLE001
        return _json_response({"error": "Invalid JSON in request body", "details": str(exc)}, status=400)
    if request.headers.get("x-stream-progress") == "true":
        async def stream() -> Iterable[bytes]:
            phases = [
                ("planning", 10),
                ("designing", 40),
                ("generating", 70),
            ]
            for phase, pct in phases:
                yield (json.dumps({"current_phase": phase, "progress_percentage": pct}) + "\n").encode("utf-8")
            result = await _generate_workflow_payload(payload)
            if "nodes" in result and "edges" in result:
                result.setdefault("status", "completed")
            yield (json.dumps(result) + "\n").encode("utf-8")

        return StreamingResponse(stream(), media_type="application/json", headers=CORS_HEADERS)

    try:
        result = await _generate_workflow_payload(payload)
        return _json_response(result)
    except ValueError as exc:
        return _json_response({"error": str(exc)}, status=400)
    except Exception as exc:  # noqa: BLE001
        return _json_response({"error": str(exc)}, status=500)


async def generate_workflow_async(request: Request) -> Response:
    if request.method == "OPTIONS":
        return Response(headers=CORS_HEADERS)

    try:
        payload = await request.json()
    except Exception as exc:  # noqa: BLE001
        return _json_response({"error": "Invalid JSON in request body", "details": str(exc)}, status=400)
    prompt = _extract_prompt(payload)
    if not prompt:
        return _json_response({"error": "Prompt is required and must be a non-empty string"}, status=400)

    supabase = get_supabase_client()
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    user_id = None
    if auth_header:
        token = auth_header.replace("Bearer ", "").replace("bearer ", "")
        user_response = supabase.auth.get_user(token)
        if user_response.user:
            user_id = user_response.user.id

    job_id = f"job_{int(datetime.now(timezone.utc).timestamp() * 1000)}_{random.randint(100000, 999999)}"
    supabase.table("workflow_generation_jobs").insert(
        {
            "id": job_id,
            "user_id": user_id,
            "prompt": prompt,
            "mode": payload.get("mode") or "create",
            "current_workflow": payload.get("currentWorkflow"),
            "execution_history": payload.get("executionHistory") or [],
            "config": payload.get("config") or {},
            "status": "queued",
            "progress_percentage": 0,
        }
    ).execute()

    return _json_response(
        {
            "job_id": job_id,
            "status": "queued",
            "message": "Workflow generation job created. Poll /workflow-status/{job_id} for results.",
            "estimated_completion_time": "30-120 seconds",
        },
        status=202,
    )


async def workflow_status(request: Request, job_id: str | None = None) -> Response:
    if request.method == "OPTIONS":
        return Response(headers=CORS_HEADERS)

    job_id = job_id or request.url.path.split("/")[-1]
    if not job_id or job_id in {"workflow-status", "status"}:
        return _json_response(
            {"error": "Job ID is required", "message": "Provide job_id in URL path: /workflow-status/{job_id}"},
            status=400,
        )

    supabase = get_supabase_client()
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    user_id = None
    if auth_header:
        token = auth_header.replace("Bearer ", "").replace("bearer ", "")
        user_response = supabase.auth.get_user(token)
        if user_response.user:
            user_id = user_response.user.id

    job_response = supabase.table("workflow_generation_jobs").select("*").eq("id", job_id).single().execute()
    job = job_response.data
    if not job:
        return _json_response({"error": "Job not found", "message": f"Job with ID {job_id} not found"}, status=404)

    if user_id and job.get("user_id") and job["user_id"] != user_id:
        return _json_response({"error": "Forbidden", "message": "You do not have access to this job"}, status=403)

    response = {
        "job_id": job["id"],
        "status": job.get("status"),
        "progress_percentage": job.get("progress_percentage") or 0,
        "current_phase": job.get("current_phase"),
        "created_at": job.get("created_at"),
        "started_at": job.get("started_at"),
        "finished_at": job.get("finished_at"),
        "duration_ms": job.get("duration_ms"),
    }
    if job.get("status") == "completed" and job.get("workflow_result"):
        response["workflow"] = job["workflow_result"]
    if job.get("status") == "failed" and job.get("error_message"):
        response["error"] = job["error_message"]
        response["error_details"] = job.get("error_details")
    if job.get("progress_logs"):
        response["progress_logs"] = job.get("progress_logs")
    if job.get("observability"):
        response["observability"] = job.get("observability")
    return _json_response(response)


@retry_configured()
async def process_job(job_id: str) -> None:
    supabase = get_supabase_client()
    job = (
        supabase.table("workflow_generation_jobs")
        .select("*")
        .eq("id", job_id)
        .single()
        .execute()
    ).data
    if not job:
        raise ValueError(f"Job not found: {job_id}")

    supabase.table("workflow_generation_jobs").update(
        {
            "status": "running",
            "progress_percentage": 5,
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", job_id).execute()

    payload = {
        "prompt": job.get("prompt"),
        "mode": job.get("mode") or "create",
        "currentWorkflow": job.get("current_workflow"),
        "executionHistory": job.get("execution_history") or [],
        "config": job.get("config") or {},
    }

    try:
        result = await _generate_workflow_payload(payload)
        supabase.table("workflow_generation_jobs").update(
            {
                "status": "completed",
                "progress_percentage": 100,
                "workflow_result": result,
                "finished_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", job_id).execute()
        logger.info("Workflow generation job completed", extra={"job_id": job_id})
    except Exception as exc:  # noqa: BLE001
        supabase.table("workflow_generation_jobs").update(
            {
                "status": "failed",
                "error_message": str(exc),
                "finished_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", job_id).execute()
        logger.exception("Workflow generation job failed", extra={"job_id": job_id, "error": str(exc)})
