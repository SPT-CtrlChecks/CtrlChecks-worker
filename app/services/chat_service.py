import json
import logging
import random
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Dict, List, Optional

import httpx
from fastapi import Request, Response

from ..data.repository import DataRepository
from ..settings import settings
from ..supabase_client import get_supabase_client
from .agent_execution import execute_agent_payload
from .workflow_execution import execute_workflow_payload

logger = logging.getLogger(__name__)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}


def _json_response(payload: Dict[str, Any], status: int = 200) -> Response:
    return Response(
        content=json.dumps(payload),
        status_code=status,
        media_type="application/json",
        headers=CORS_HEADERS,
    )


@lru_cache(maxsize=1)
def _load_knowledge() -> Dict[str, Any]:
    try:
        data_repo = DataRepository()
        personas = data_repo.load_json("agent_personas.json")
        knowledge = personas.get("chatbot", {}).get("knowledge", {})
        if knowledge:
            return knowledge
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to load chatbot knowledge", extra={"error": str(exc)})
    return {
        "personality": {
            "fallback": "Hmm, I'm not sure I have that specific information right now."
        },
        "escalation": {"triggers": [], "response": "Please contact support."},
        "conversion": {"suggestions": {"general": []}},
        "faqs": [],
    }


def _should_escalate(message: str, knowledge: Dict[str, Any]) -> bool:
    triggers = knowledge.get("escalation", {}).get("triggers", [])
    lower = message.lower()
    return any(trigger.lower() in lower for trigger in triggers)


def _find_faq(message: str, knowledge: Dict[str, Any]) -> Optional[Dict[str, str]]:
    lower = message.lower()
    for faq in knowledge.get("faqs", []):
        for keyword in faq.get("keywords", []):
            if keyword.lower() in lower:
                return {"question": faq.get("question", ""), "answer": faq.get("answer", "")}
    for faq in knowledge.get("faqs", []):
        for word in faq.get("question", "").lower().split():
            if len(word) > 3 and word in lower:
                return {"question": faq.get("question", ""), "answer": faq.get("answer", "")}
    return None


def _suggestions(message: str, knowledge: Dict[str, Any]) -> List[str]:
    lower = message.lower()
    suggestions = knowledge.get("conversion", {}).get("suggestions", {})
    if any(k in lower for k in ("pricing", "plan", "cost")):
        return suggestions.get("pricing", [])
    if any(k in lower for k in ("feature", "what can", "build")):
        return suggestions.get("features", [])
    if any(k in lower for k in ("start", "begin", "get started")):
        return suggestions.get("getting_started", [])
    return suggestions.get("general", [])


async def chatbot(request: Request) -> Response:
    if request.method == "OPTIONS":
        return Response(headers=CORS_HEADERS)
    if request.method != "POST":
        return _json_response({"error": "Method not allowed"}, status=405)

    try:
        body = await request.json()
    except Exception:
        return _json_response({"error": "Invalid JSON in request body"}, status=400)

    message = (body.get("message") or "").strip()
    if not message:
        return _json_response({"error": "Message is required"}, status=400)

    knowledge = _load_knowledge()
    if _should_escalate(message, knowledge):
        response = {
            "content": knowledge.get("escalation", {}).get("response", ""),
            "suggestions": ["Contact sales", "View enterprise plans"],
            "escalation": True,
        }
        return _json_response(response)

    faq = _find_faq(message, knowledge)
    if faq:
        return _json_response({"content": faq["answer"], "suggestions": _suggestions(message, knowledge)})

    try:
        data_repo = DataRepository()
        prompt_template = data_repo.get_prompt_template(
            "chat_assistant",
            variables={"knowledge": json.dumps(knowledge), "user_message": message},
        )
        system_prompt = prompt_template or "Answer based on the knowledge base only."
        url = settings.ollama_base_url.rstrip("/") + "/api/chat"
        body = {
            "model": "llama3",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message},
            ],
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=settings.ollama_timeout_seconds) as client:
            resp = await client.post(url, json=body)
        resp.raise_for_status()
        data = resp.json()
        content = (data.get("message", {}) or {}).get("content", "").strip()
        if not content:
            content = knowledge.get("personality", {}).get("fallback", "")
        return _json_response({"content": content, "suggestions": _suggestions(message, knowledge)})
    except Exception as exc:  # noqa: BLE001
        logger.warning("Chatbot API failed", extra={"error": str(exc)})
        return _json_response(
            {
                "content": knowledge.get("personality", {}).get("fallback", ""),
                "suggestions": _suggestions(message, knowledge),
            }
        )


async def process_chat_message(body: Dict[str, Any]) -> Dict[str, Any]:
    supabase = get_supabase_client()
    workflow_id = body.get("workflowId")
    message = body.get("message")
    session_id = body.get("sessionId")
    metadata = body.get("metadata") or {}

    if not workflow_id:
        raise ValueError("workflowId is required")
    if not message or not isinstance(message, str) or not message.strip():
        raise ValueError("message is required")

    workflow = (
        supabase.table("workflows").select("*").eq("id", workflow_id).single().execute()
    ).data
    if not workflow:
        raise ValueError("Workflow not found")
    if workflow.get("workflow_type") not in {"chatbot", "agent"}:
        raise ValueError("Workflow is not a chatbot or agent type")

    if session_id:
        chat_session_id = session_id
    else:
        chat_session_id = f"chat-{int(datetime.now(timezone.utc).timestamp() * 1000)}-{random.randint(100000, 999999)}"
    await _store_memory(chat_session_id, "user", message, metadata)

    workflow_input = {
        "message": message,
        "session_id": chat_session_id,
        "_session_id": chat_session_id,
        "_workflow_id": workflow_id,
        "metadata": metadata,
    }

    if workflow.get("workflow_type") == "agent":
        workflow_response = await execute_agent_payload(
            {
                "workflowId": workflow_id,
                "input": workflow_input,
                "config": workflow.get("agent_config") or {},
            }
        )
    else:
        workflow_response = await execute_workflow_payload(
            {"workflowId": workflow_id, "input": workflow_input}
        )

    response_text = ""
    if isinstance(workflow_response.get("output"), str):
        response_text = workflow_response["output"]
    elif isinstance(workflow_response.get("output"), dict):
        output = workflow_response["output"]
        response_text = (
            output.get("message")
            or output.get("text")
            or output.get("content")
            or json.dumps(output)
        )
    elif workflow_response.get("result"):
        result = workflow_response["result"]
        response_text = result if isinstance(result, str) else json.dumps(result)
    if not response_text:
        response_text = "I'm sorry, I couldn't generate a response."

    await _store_memory(chat_session_id, "assistant", response_text, None)
    return {
        "response": response_text,
        "sessionId": chat_session_id,
        "metadata": {"workflowId": workflow_id, "executionId": workflow_response.get("executionId"), **metadata},
    }


async def chat_api(request: Request) -> Response:
    if request.method == "OPTIONS":
        return Response(headers=CORS_HEADERS)

    try:
        body = await request.json()
        payload = await process_chat_message(body)
        return _json_response(payload)
    except ValueError as exc:
        return _json_response({"error": str(exc)}, status=400)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Chat API error", extra={"error": str(exc)})
        return _json_response(
            {
                "error": str(exc),
                "response": "I'm sorry, something went wrong. Please try again.",
            },
            status=500,
        )


async def _store_memory(session_id: str, role: str, content: str, metadata: Optional[Dict[str, Any]]) -> None:
    supabase = get_supabase_client()
    existing = (
        supabase.table("memory_sessions")
        .select("id")
        .eq("session_id", session_id)
        .single()
        .execute()
    ).data
    if not existing:
        supabase.table("memory_sessions").insert({"session_id": session_id}).execute()
    supabase.table("memory_messages").insert(
        {"session_id": session_id, "role": role, "content": content, "metadata": metadata or {}}
    ).execute()
