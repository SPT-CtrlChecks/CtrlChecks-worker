import json
import logging
from datetime import datetime, timezone

import httpx
from fastapi import Request, Response

from ..settings import settings

logger = logging.getLogger(__name__)


async def ollama_health(request: Request) -> Response:
    if request.method == "OPTIONS":
        return Response(headers={"Access-Control-Allow-Origin": "*"})
    timeout = httpx.Timeout(1.0)
    url = settings.ollama_base_url.rstrip("/")
    health_url = f"{url}/api/tags"

    start = datetime.now(timezone.utc)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(health_url)
        elapsed = (datetime.now(timezone.utc) - start).total_seconds() * 1000
        if resp.status_code < 500:
            payload = {
                "status": "healthy",
                "endpoint": health_url,
                "responseTimeMs": int(elapsed),
                "statusCode": resp.status_code,
                "elapsedMs": int(elapsed),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            return Response(
                content=json.dumps(payload),
                status_code=200,
                media_type="application/json",
                headers={"Access-Control-Allow-Origin": "*"},
            )
        payload = {
            "status": "unhealthy",
            "endpoint": health_url,
            "statusCode": resp.status_code,
            "elapsedMs": int(elapsed),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": resp.text[:200],
        }
        return Response(
            content=json.dumps(payload),
            status_code=503,
            media_type="application/json",
            headers={"Access-Control-Allow-Origin": "*"},
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Ollama health check failed", extra={"error": str(exc)})
        elapsed = (datetime.now(timezone.utc) - start).total_seconds() * 1000
        payload = {
            "status": "error",
            "error": str(exc),
            "elapsedMs": int(elapsed),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        return Response(
            content=json.dumps(payload),
            status_code=500,
            media_type="application/json",
            headers={"Access-Control-Allow-Origin": "*"},
        )
