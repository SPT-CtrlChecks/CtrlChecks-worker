from fastapi import APIRouter, Depends, Request, Response

from ...dependencies import get_current_user
from ...services.workflow_analysis import analyze_workflow_requirements
from ...services.workflow_execution import execute_node, execute_workflow
from ...services.workflow_generation import generate_workflow, generate_workflow_async, workflow_status

router = APIRouter(tags=["workflows"])


@router.api_route("/generate", methods=["POST", "OPTIONS"])
async def generate_workflow_route(request: Request, _user=Depends(get_current_user)) -> Response:
    return await generate_workflow(request)


@router.api_route("/generate/async", methods=["POST", "OPTIONS"])
async def generate_workflow_async_route(request: Request, _user=Depends(get_current_user)) -> Response:
    return await generate_workflow_async(request)


@router.api_route("/{job_id}/status", methods=["GET", "OPTIONS"])
async def workflow_status_route(
    request: Request, job_id: str, _user=Depends(get_current_user)
) -> Response:
    return await workflow_status(request, job_id=job_id)


@router.api_route("/analyze", methods=["POST", "OPTIONS"])
async def analyze_workflow_route(request: Request, _user=Depends(get_current_user)) -> Response:
    return await analyze_workflow_requirements(request)


@router.api_route("/execute", methods=["POST", "OPTIONS"])
async def execute_workflow_route(request: Request, _user=Depends(get_current_user)) -> Response:
    return await execute_workflow(request)


@router.api_route("/nodes/execute", methods=["POST", "OPTIONS"])
async def execute_node_route(request: Request, _user=Depends(get_current_user)) -> Response:
    return await execute_node(request)
