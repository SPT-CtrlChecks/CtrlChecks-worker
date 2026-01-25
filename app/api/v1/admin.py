from fastapi import APIRouter, Depends, Request, Response

from ...dependencies import require_admin
from ...services.template_service import admin_templates

router = APIRouter(tags=["admin"])


@router.api_route("/templates", methods=["GET", "POST", "OPTIONS"])
async def admin_templates_root(request: Request, _admin=Depends(require_admin)) -> Response:
    return await admin_templates(request)


@router.api_route("/templates/{template_id}", methods=["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def admin_templates_item(
    request: Request, template_id: str, _admin=Depends(require_admin)
) -> Response:
    return await admin_templates(request)
