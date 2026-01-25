from fastapi import APIRouter, Request, Response

from ..services.ollama import ollama_health

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.api_route("/health/ollama", methods=["GET", "OPTIONS"])
@router.api_route("/ollama-health", methods=["GET", "OPTIONS"])
async def ollama_health_route(request: Request) -> Response:
    return await ollama_health(request)
