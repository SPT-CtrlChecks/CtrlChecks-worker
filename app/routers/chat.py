from fastapi import APIRouter, Depends, Request, Response

from ..dependencies import get_optional_user
from ..services.chat_service import chat_api, chatbot

router = APIRouter(tags=["chat"])


@router.api_route("/chat-api", methods=["POST", "OPTIONS"])
async def chat_api_route(request: Request, _user=Depends(get_optional_user)) -> Response:
    return await chat_api(request)


@router.api_route("/chatbot", methods=["POST", "OPTIONS"])
async def chatbot_route(request: Request, _user=Depends(get_optional_user)) -> Response:
    return await chatbot(request)
