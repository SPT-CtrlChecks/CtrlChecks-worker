import json
import logging
from typing import Any, Dict

import httpx
from fastapi import Request, Response

from ..settings import settings

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


async def _ollama_text(task: str, prompt: str) -> str:
    url = settings.ollama_base_url.rstrip("/") + "/api/chat"
    system = f"You are a helpful assistant for task: {task}. Respond concisely."
    body = {
        "model": "llama3",
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=settings.ollama_timeout_seconds) as client:
        resp = await client.post(url, json=body)
    resp.raise_for_status()
    data = resp.json()
    return data.get("message", {}).get("content", "")


async def execute_multimodal_agent(request: Request) -> Response:
    if request.method == "OPTIONS":
        return Response(headers=CORS_HEADERS)

    payload = await request.json()
    task = payload.get("task")
    if task:
        try:
            if task in {"summarize", "translate", "extract", "sentiment", "generate", "qa", "chat", "story"}:
                prompt = payload.get("input") or payload.get("context") or ""
                if task == "qa":
                    question = payload.get("question") or ""
                    context = payload.get("context") or prompt
                    prompt = f"Question: {question}\nContext: {context}"
                output = await _ollama_text(task, prompt)
                return _json_response({"success": True, "output": output, "isFallback": False})
            return _json_response({"success": False, "error": "Unsupported task"}, status=400)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Multimodal task failed", extra={"error": str(exc)})
            return _json_response({"success": False, "error": str(exc)}, status=500)

    pipeline = payload.get("pipeline")
    input_text = payload.get("input") or ""
    if pipeline:
        try:
            output = await _ollama_text("process", input_text)
            return _json_response({"success": True, "output": output, "isFallback": False})
        except Exception as exc:  # noqa: BLE001
            return _json_response({"success": False, "error": str(exc)}, status=500)

    return _json_response({"success": False, "error": "Invalid request"}, status=400)


async def build_multimodal_agent(request: Request) -> Response:
    if request.method == "OPTIONS":
        return Response(headers=CORS_HEADERS)
    payload = await request.json()
    prompt = (payload.get("prompt") or "").strip()
    if not prompt:
        return _json_response({"success": False, "error": "Prompt is required"}, status=400)
    return _json_response({"success": True, "agent": {"prompt": prompt, "files": payload.get("files", [])}})
