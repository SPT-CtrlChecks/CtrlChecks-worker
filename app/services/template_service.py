import json
import logging
from typing import Any, Dict

from fastapi import Request, Response

from ..supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
}


def _json_response(payload: Dict[str, Any], status: int = 200) -> Response:
    return Response(
        content=json.dumps(payload),
        status_code=status,
        media_type="application/json",
        headers=CORS_HEADERS,
    )


async def copy_template(request: Request, template_id_override: str | None = None) -> Response:
    if request.method == "OPTIONS":
        return Response(headers=CORS_HEADERS)
    if request.method != "POST":
        return _json_response({"error": "Method not allowed"}, status=405)

    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth_header:
        return _json_response({"error": "Unauthorized"}, status=401)

    supabase = get_supabase_client()
    token = auth_header.replace("Bearer ", "").strip()
    user_response = supabase.auth.get_user(token)
    if user_response.user is None:
        return _json_response({"error": "Unauthorized"}, status=401)

    payload = await request.json()
    template_id = template_id_override or payload.get("templateId")
    workflow_name = payload.get("workflowName")
    if not template_id:
        return _json_response({"error": "templateId is required"}, status=400)

    template_response = (
        supabase.table("templates")
        .select("*")
        .eq("id", template_id)
        .eq("is_active", True)
        .single()
        .execute()
    )
    template = template_response.data
    if not template:
        return _json_response({"error": "Template not found or inactive"}, status=404)

    workflow_response = (
        supabase.table("workflows")
        .insert(
            {
                "name": workflow_name or f"{template['name']} (Copy)",
                "nodes": template.get("nodes"),
                "edges": template.get("edges"),
                "user_id": user_response.user.id,
                "source": "template",
                "template_id": template["id"],
                "template_version": template.get("version"),
                "status": "draft",
            }
        )
        .select()
        .single()
        .execute()
    )
    workflow = workflow_response.data
    if not workflow:
        return _json_response({"error": "Failed to create workflow"}, status=500)

    supabase.table("templates").update(
        {"use_count": (template.get("use_count") or 0) + 1}
    ).eq("id", template_id).execute()

    return _json_response({"workflow": workflow, "message": "Template copied successfully"}, status=201)


async def admin_templates(request: Request) -> Response:
    if request.method == "OPTIONS":
        return Response(headers=CORS_HEADERS)

    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth_header:
        return _json_response({"error": "Unauthorized"}, status=401)

    supabase = get_supabase_client()
    token = auth_header.replace("Bearer ", "").strip()
    user_response = supabase.auth.get_user(token)
    user = user_response.user
    if user is None:
        return _json_response({"error": "Unauthorized"}, status=401)

    role_response = (
        supabase.table("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single()
        .execute()
    )
    if not role_response.data:
        return _json_response({"error": "Admin access required"}, status=403)

    path = request.url.path
    method = request.method
    is_admin_root = path.endswith("/admin-templates") or path.endswith("/admin/templates")
    is_admin_item = "/admin-templates/" in path or "/admin/templates/" in path

    if method == "GET" and is_admin_root:
        data = (
            supabase.table("templates")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        return _json_response({"templates": data.data or []})

    if method == "GET" and is_admin_item:
        template_id = path.split("/").pop()
        template = (
            supabase.table("templates")
            .select("*")
            .eq("id", template_id)
            .single()
            .execute()
        ).data
        if template is None:
            return _json_response({"error": "Template not found"}, status=404)
        return _json_response({"template": template})

    if method == "POST" and is_admin_root:
        body = await request.json()
        template = (
            supabase.table("templates")
            .insert(
                {
                    "name": body.get("name"),
                    "description": body.get("description"),
                    "category": body.get("category"),
                    "nodes": body.get("nodes"),
                    "edges": body.get("edges"),
                    "difficulty": body.get("difficulty") or "Beginner",
                    "estimated_setup_time": body.get("estimated_setup_time") or 5,
                    "tags": body.get("tags") or [],
                    "is_featured": body.get("is_featured") or False,
                    "preview_image": body.get("preview_image"),
                    "created_by": user.id,
                    "version": 1,
                    "is_active": True,
                }
            )
            .select()
            .single()
            .execute()
        ).data
        if template is None:
            return _json_response({"error": "Failed to create template"}, status=500)
        return _json_response({"template": template}, status=201)

    if method == "PUT" and is_admin_item:
        template_id = path.split("/").pop()
        body = await request.json()
        template = (
            supabase.table("templates")
            .update(
                {
                    "name": body.get("name"),
                    "description": body.get("description"),
                    "category": body.get("category"),
                    "nodes": body.get("nodes"),
                    "edges": body.get("edges"),
                    "difficulty": body.get("difficulty"),
                    "estimated_setup_time": body.get("estimated_setup_time"),
                    "tags": body.get("tags"),
                    "is_featured": body.get("is_featured"),
                    "preview_image": body.get("preview_image"),
                    "updated_by": user.id,
                }
            )
            .eq("id", template_id)
            .select()
            .single()
            .execute()
        ).data
        if template is None:
            return _json_response({"error": "Failed to update template"}, status=500)
        return _json_response({"template": template})

    if method == "PATCH" and is_admin_item:
        template_id = path.split("/").pop()
        body = await request.json()
        update_payload: Dict[str, Any] = {"updated_by": user.id}
        if "is_active" in body:
            update_payload["is_active"] = body["is_active"]
        if "is_featured" in body:
            update_payload["is_featured"] = body["is_featured"]
        template = (
            supabase.table("templates")
            .update(update_payload)
            .eq("id", template_id)
            .select()
            .single()
            .execute()
        ).data
        if template is None:
            return _json_response({"error": "Failed to update template"}, status=500)
        return _json_response({"template": template})

    if method == "DELETE" and is_admin_item:
        template_id = path.split("/").pop()
        count_response = (
            supabase.table("workflows")
            .select("*", count="exact", head=True)
            .eq("template_id", template_id)
            .execute()
        )
        count = count_response.count or 0
        if count > 0:
            template = (
                supabase.table("templates")
                .update({"is_active": False, "updated_by": user.id})
                .eq("id", template_id)
                .select()
                .single()
                .execute()
            ).data
            return _json_response(
                {"template": template, "message": "Template deactivated (workflows are using it)"}
            )
        supabase.table("templates").delete().eq("id", template_id).execute()
        return _json_response({"message": "Template deleted"})

    return _json_response({"error": "Method not allowed"}, status=405)
