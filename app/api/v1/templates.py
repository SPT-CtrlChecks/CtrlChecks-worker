from fastapi import APIRouter, Depends, Request, Response

from ...dependencies import get_current_user
from ...services.template_service import copy_template

router = APIRouter(tags=["templates"])


@router.api_route("/{template_id}/copy", methods=["POST", "OPTIONS"])
async def copy_template_route(
    request: Request, template_id: str, _user=Depends(get_current_user)
) -> Response:
    return await copy_template(request, template_id_override=template_id)
