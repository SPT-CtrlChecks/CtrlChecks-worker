import json
import logging

import httpx
from fastapi import Request, Response

from ..data.repository import DataRepository
from ..settings import settings

logger = logging.getLogger(__name__)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}


async def analyze_workflow_requirements(request: Request) -> Response:
    if request.method == "OPTIONS":
        return Response(headers=CORS_HEADERS)

    payload = await request.json()
    prompt = (payload.get("prompt") or "").strip()
    if not prompt:
        return Response(
            content=json.dumps({"error": "Prompt is required"}),
            status_code=400,
            media_type="application/json",
            headers=CORS_HEADERS,
        )

    data_repo = DataRepository()
    system_prompt = data_repo.get_prompt_template(
        "requirement_analysis",
        variables={"user_prompt": prompt},
    )
    if not system_prompt:
        system_prompt = (
            "Analyze workflow prompt and return JSON with key requirements (array). "
            "Each requirement: key, label, type, description, required. "
            "If none, return {\"requirements\": []}."
        )

    try:
        url = settings.ollama_base_url.rstrip("/") + "/api/chat"
        body = {
            "model": "llama3",
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
        text = data.get("message", {}).get("content", "")
        try:
            return Response(
                content=json.dumps(json.loads(text)),
                media_type="application/json",
                headers=CORS_HEADERS,
            )
        except json.JSONDecodeError:
            return Response(
                content=json.dumps({"requirements": []}),
                media_type="application/json",
                headers=CORS_HEADERS,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Requirement analysis failed", extra={"error": str(exc)})

    return Response(
        content=json.dumps({"requirements": []}),
        media_type="application/json",
        headers=CORS_HEADERS,
    )
