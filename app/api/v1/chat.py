import json

from fastapi import APIRouter, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from ...auth import get_user_from_token
from ...dependencies import get_current_user
from ...services.chat_service import process_chat_message

router = APIRouter(tags=["chat"])


@router.post("/message")
async def chat_message_route(request: Request, _user=Depends(get_current_user)) -> JSONResponse:
    body = await request.json()
    payload = await process_chat_message(body)
    return JSONResponse(payload)


@router.websocket("/ws")
async def chat_ws_route(websocket: WebSocket):
    auth_header = websocket.headers.get("authorization")
    token = auth_header.replace("Bearer ", "").replace("bearer ", "").strip() if auth_header else None
    if not token:
        token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401)
        return None
    try:
        get_user_from_token(token)
    except Exception:
        await websocket.close(code=4401)
        return None

    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON payload"})
                continue
            try:
                response = await process_chat_message(payload)
                await websocket.send_json(response)
            except Exception as exc:  # noqa: BLE001
                await websocket.send_json({"error": str(exc)})
    except WebSocketDisconnect:
        return None
