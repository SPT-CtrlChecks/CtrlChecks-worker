from fastapi import APIRouter, Depends, Request, Response

from ..dependencies import get_current_user
from ..services.agent_execution import execute_agent
from ..services.multimodal import build_multimodal_agent, execute_multimodal_agent

router = APIRouter(tags=["agents"])


@router.api_route("/execute-agent", methods=["POST", "OPTIONS"])
async def execute_agent_route(request: Request, _user=Depends(get_current_user)) -> Response:
    return await execute_agent(request)


@router.api_route("/execute-multimodal-agent", methods=["POST", "OPTIONS"])
async def execute_multimodal_route(request: Request, _user=Depends(get_current_user)) -> Response:
    return await execute_multimodal_agent(request)


@router.api_route("/build-multimodal-agent", methods=["POST", "OPTIONS"])
async def build_multimodal_route(request: Request, _user=Depends(get_current_user)) -> Response:
    return await build_multimodal_agent(request)
