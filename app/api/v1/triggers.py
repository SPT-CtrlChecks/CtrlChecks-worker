from fastapi import APIRouter, Depends, Request, Response

from ...dependencies import get_current_user
from ...services.triggers import form_trigger_api

router = APIRouter(tags=["triggers"])


@router.api_route("/form", methods=["POST", "OPTIONS"])
async def form_trigger_route(request: Request, _user=Depends(get_current_user)) -> Response:
    return await form_trigger_api(request)
