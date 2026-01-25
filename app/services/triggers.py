import json
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import Request, Response

from ..supabase_client import get_supabase_client
from .workflow_execution import execute_workflow_payload

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
}


def _json_response(payload: Dict[str, Any], status: int = 200) -> Response:
    return Response(
        content=json.dumps(payload),
        status_code=status,
        media_type="application/json",
        headers=CORS_HEADERS,
    )


async def form_trigger(request: Request) -> Response:
    if request.method == "OPTIONS":
        return Response(status_code=204, headers=CORS_HEADERS)

    url = request.url
    path_parts = [p for p in url.path.split("/") if p]
    try:
        function_index = path_parts.index("form-trigger")
    except ValueError:
        return _json_response(
            {"error": "Invalid URL", "message": "Invalid URL format. Expected /form-trigger/{workflowId}/{nodeId}"},
            status=400,
        )

    remaining = path_parts[function_index + 1 :]
    is_submit = remaining and remaining[-1] == "submit"
    if is_submit:
        remaining = remaining[:-1]
    workflow_id = remaining[0] if len(remaining) > 0 else None
    node_id = remaining[1] if len(remaining) > 1 else None

    if not workflow_id or not node_id:
        return _json_response(
            {"error": "Invalid URL", "message": "Missing workflowId or nodeId in URL."},
            status=400,
        )

    supabase = get_supabase_client()
    workflow = (
        supabase.table("workflows").select("*").eq("id", workflow_id).single().execute()
    ).data
    if not workflow:
        return _json_response({"error": "Workflow not found", "message": "The requested workflow could not be found."}, status=404)
    if workflow.get("status") != "active":
        return _json_response(
            {"error": "Form expired", "message": "This form is no longer active. The workflow has been deactivated."},
            status=400,
        )

    nodes = workflow.get("nodes") or []
    form_node = next(
        (
            node
            for node in nodes
            if (node.get("id") == node_id or node.get("data", {}).get("id") == node_id)
            and ((node.get("data", {}).get("type") or node.get("type")) == "form")
        ),
        None,
    )
    if not form_node:
        return _json_response({"error": "Form not found", "message": "The form node was not found in this workflow."}, status=404)

    config = form_node.get("data", {}).get("config") or form_node.get("config") or {}
    fields = config.get("fields") or []
    if isinstance(fields, str):
        try:
            fields = json.loads(fields)
        except json.JSONDecodeError:
            fields = []

    if request.method == "GET":
        form_config = {
            "workflowId": workflow_id,
            "nodeId": node_id,
            "formTitle": config.get("formTitle") or "Form Submission",
            "formDescription": config.get("formDescription") or "",
            "fields": fields,
            "submitButtonText": config.get("submitButtonText") or "Submit",
            "successMessage": config.get("successMessage") or "Thank you for your submission!",
            "redirectUrl": config.get("redirectUrl") or "",
            "submitUrl": f"{str(request.base_url).rstrip('/')}{request.url.path.rstrip('/')}/submit",
        }
        return _json_response(form_config)

    if request.method == "POST" and is_submit:
        idempotency_key = request.headers.get("x-idempotency-key") or f"form_{workflow_id}_{node_id}_{int(datetime.now(timezone.utc).timestamp())}"
        existing = (
            supabase.table("form_submissions")
            .select("execution_id")
            .eq("idempotency_key", idempotency_key)
            .single()
            .execute()
        ).data
        if existing:
            return _json_response({"success": True, "message": config.get("successMessage") or "Thank you for your submission!", "duplicate": True})

        body = {}
        try:
            body = await request.json()
        except Exception:
            body = {}
        form_data = body.get("formData") or body.get("data") or body
        submitted_at = datetime.now(timezone.utc).isoformat()
        submission_data = {
            "submitted_at": submitted_at,
            "form": {"title": config.get("formTitle") or "Form Submission", "id": node_id},
            "data": form_data,
            "files": body.get("files") or [],
            "meta": {"source": "form-trigger"},
        }

        waiting_execution = (
            supabase.table("executions")
            .select("*")
            .eq("workflow_id", workflow_id)
            .eq("status", "waiting")
            .eq("trigger", "form")
            .eq("waiting_for_node_id", node_id)
            .order("started_at", desc=False)
            .limit(1)
            .single()
            .execute()
        ).data
        if not waiting_execution:
            return _json_response(
                {"error": "No active form", "message": "This form is not currently waiting for a submission. Please activate the workflow first."},
                status=400,
            )

        supabase.table("form_submissions").insert(
            {
                "workflow_id": workflow_id,
                "node_id": node_id,
                "execution_id": waiting_execution["id"],
                "idempotency_key": idempotency_key,
                "form_data": submission_data,
                "submitted_at": submitted_at,
            }
        ).execute()

        execution_input = {
            "submitted_at": submitted_at,
            "form": {"title": submission_data["form"]["title"], "id": node_id},
            "data": submission_data["data"],
            "files": submission_data["files"],
            "meta": submission_data["meta"],
        }
        supabase.table("executions").update(
            {"status": "running", "input": execution_input, "waiting_for_node_id": None}
        ).eq("id", waiting_execution["id"]).execute()

        await execute_workflow_payload(
            {"workflowId": workflow_id, "executionId": waiting_execution["id"], "input": execution_input}
        )

        redirect = config.get("redirectUrl") or ""
        payload = {"success": True, "message": config.get("successMessage") or "Thank you for your submission!"}
        if redirect:
            payload["redirect"] = redirect
        return _json_response(payload)

    return _json_response({"error": "Method not allowed", "message": "This endpoint only supports GET and POST requests."}, status=405)


async def form_trigger_api(request: Request) -> Response:
    if request.method == "OPTIONS":
        return Response(status_code=204, headers=CORS_HEADERS)
    if request.method != "POST":
        return _json_response({"error": "Method not allowed"}, status=405)

    try:
        body = await request.json()
    except Exception:
        body = {}

    workflow_id = body.get("workflowId")
    node_id = body.get("nodeId")
    if not workflow_id or not node_id:
        return _json_response({"error": "workflowId and nodeId are required"}, status=400)

    supabase = get_supabase_client()
    workflow = (
        supabase.table("workflows").select("*").eq("id", workflow_id).single().execute()
    ).data
    if not workflow:
        return _json_response({"error": "Workflow not found", "message": "The requested workflow could not be found."}, status=404)
    if workflow.get("status") != "active":
        return _json_response(
            {"error": "Form expired", "message": "This form is no longer active. The workflow has been deactivated."},
            status=400,
        )

    nodes = workflow.get("nodes") or []
    form_node = next(
        (
            node
            for node in nodes
            if (node.get("id") == node_id or node.get("data", {}).get("id") == node_id)
            and ((node.get("data", {}).get("type") or node.get("type")) == "form")
        ),
        None,
    )
    if not form_node:
        return _json_response({"error": "Form not found", "message": "The form node was not found in this workflow."}, status=404)

    config = form_node.get("data", {}).get("config") or form_node.get("config") or {}
    idempotency_key = request.headers.get("x-idempotency-key") or body.get("idempotencyKey")
    if not idempotency_key:
        idempotency_key = f"form_{workflow_id}_{node_id}_{int(datetime.now(timezone.utc).timestamp())}"
    existing = (
        supabase.table("form_submissions")
        .select("execution_id")
        .eq("idempotency_key", idempotency_key)
        .single()
        .execute()
    ).data
    if existing:
        return _json_response(
            {
                "success": True,
                "message": config.get("successMessage") or "Thank you for your submission!",
                "duplicate": True,
            }
        )

    form_data = body.get("formData") or body.get("data") or {}
    submitted_at = datetime.now(timezone.utc).isoformat()
    submission_data = {
        "submitted_at": submitted_at,
        "form": {"title": config.get("formTitle") or "Form Submission", "id": node_id},
        "data": form_data,
        "files": body.get("files") or [],
        "meta": {"source": "form-trigger"},
    }

    waiting_execution = (
        supabase.table("executions")
        .select("*")
        .eq("workflow_id", workflow_id)
        .eq("status", "waiting")
        .eq("trigger", "form")
        .eq("waiting_for_node_id", node_id)
        .order("started_at", desc=False)
        .limit(1)
        .single()
        .execute()
    ).data
    if not waiting_execution:
        return _json_response(
            {"error": "No active form", "message": "This form is not currently waiting for a submission. Please activate the workflow first."},
            status=400,
        )

    supabase.table("form_submissions").insert(
        {
            "workflow_id": workflow_id,
            "node_id": node_id,
            "execution_id": waiting_execution["id"],
            "idempotency_key": idempotency_key,
            "form_data": submission_data,
            "submitted_at": submitted_at,
        }
    ).execute()

    execution_input = {
        "submitted_at": submitted_at,
        "form": {"title": submission_data["form"]["title"], "id": node_id},
        "data": submission_data["data"],
        "files": submission_data["files"],
        "meta": submission_data["meta"],
    }
    supabase.table("executions").update(
        {"status": "running", "input": execution_input, "waiting_for_node_id": None}
    ).eq("id", waiting_execution["id"]).execute()

    await execute_workflow_payload(
        {"workflowId": workflow_id, "executionId": waiting_execution["id"], "input": execution_input}
    )

    redirect = config.get("redirectUrl") or ""
    payload = {"success": True, "message": config.get("successMessage") or "Thank you for your submission!"}
    if redirect:
        payload["redirect"] = redirect
    return _json_response(payload)


async def webhook_trigger(request: Request) -> Response:
    if request.method == "OPTIONS":
        return Response(headers=CORS_HEADERS)

    workflow_id = request.url.path.split("/")[-1]
    if not workflow_id:
        return _json_response({"error": "Workflow ID is required"}, status=400)

    input_data: Dict[str, Any] = {}
    if request.method == "POST":
        try:
            body_text = await request.body()
            if body_text:
                input_data = json.loads(body_text.decode("utf-8"))
        except Exception:
            input_data = {}

    query_params: Dict[str, str] = dict(request.query_params)
    session_id = query_params.get("session_id") or input_data.get("session_id")
    if not session_id:
        session_id = f"session_{int(datetime.now(timezone.utc).timestamp())}"
    full_input = {**query_params, **input_data, "_webhook": True, "_method": request.method, "session_id": session_id}

    supabase = get_supabase_client()
    workflow = (
        supabase.table("workflows").select("*").eq("id", workflow_id).single().execute()
    ).data
    if not workflow:
        return _json_response({"error": "Workflow not found"}, status=404)
    if not workflow.get("webhook_url"):
        return _json_response({"error": "Webhook not enabled for this workflow"}, status=403)
    if workflow.get("status") != "active":
        return _json_response({"error": "Workflow is not active"}, status=400)

    execution = (
        supabase.table("executions")
        .insert(
            {
                "workflow_id": workflow_id,
                "user_id": workflow.get("user_id"),
                "status": "pending",
                "trigger": "webhook",
                "input": full_input,
                "logs": [],
                "started_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .select()
        .single()
        .execute()
    ).data
    if not execution:
        return _json_response({"error": "Failed to create execution"}, status=500)

    result = await execute_workflow_payload(
        {"workflowId": workflow_id, "executionId": execution["id"], "input": full_input}
    )

    if result.get("status") != "success":
        supabase.table("executions").update(
            {"status": "failed", "error": result.get("error"), "finished_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", execution["id"]).execute()
        return _json_response(
            {"error": "Workflow execution failed", "reply": "Sorry, I encountered an error processing your request. Please try again."},
            status=500,
        )

    db_execution = (
        supabase.table("executions")
        .select("output, logs, status, error")
        .eq("id", execution["id"])
        .single()
        .execute()
    ).data
    output = db_execution.get("output") if db_execution else result.get("output")
    return _json_response({"success": True, "output": output, "executionId": execution["id"], "sessionId": session_id})
