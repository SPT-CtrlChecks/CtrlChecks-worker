from fastapi import APIRouter, Depends, Request, Response

from ...dependencies import get_current_user
from ...services.ollama import ollama_health

router = APIRouter(tags=["llm"])


@router.api_route("/health", methods=["GET", "OPTIONS"])
async def ollama_health_route(request: Request, _user=Depends(get_current_user)) -> Response:
    return await ollama_health(request)
