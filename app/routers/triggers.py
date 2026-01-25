from fastapi import APIRouter, Request, Response

from ..services.triggers import form_trigger, webhook_trigger

router = APIRouter(tags=["triggers"])


@router.api_route("/form-trigger/{path:path}", methods=["GET", "POST", "OPTIONS"])
async def form_trigger_route(request: Request) -> Response:
    return await form_trigger(request)


@router.api_route("/webhook-trigger/{workflow_id}", methods=["GET", "POST", "OPTIONS"])
async def webhook_trigger_route(request: Request, workflow_id: str) -> Response:
    return await webhook_trigger(request)
