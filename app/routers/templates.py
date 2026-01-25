from fastapi import APIRouter, Depends, Request, Response

from ..dependencies import get_current_user, require_admin
from ..services.template_service import admin_templates, copy_template

router = APIRouter(tags=["templates"])


@router.api_route("/copy-template", methods=["POST", "OPTIONS"])
async def copy_template_route(request: Request, _user=Depends(get_current_user)) -> Response:
    return await copy_template(request)


@router.api_route("/admin-templates", methods=["GET", "POST", "OPTIONS"])
async def admin_templates_root(request: Request, _admin=Depends(require_admin)) -> Response:
    return await admin_templates(request)


@router.api_route("/admin-templates/{template_id}", methods=["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def admin_templates_item(request: Request, template_id: str, _admin=Depends(require_admin)) -> Response:
    return await admin_templates(request)
