from fastapi import APIRouter, Depends, Request, Response

from ..dependencies import get_optional_user, get_worker_pool
from ..services.workflow_generation import process_job, workflow_status

router = APIRouter(tags=["jobs"])


@router.api_route("/workflow-status/{job_id}", methods=["GET", "OPTIONS"])
async def workflow_status_route(request: Request, _user=Depends(get_optional_user)) -> Response:
    return await workflow_status(request)


@router.post("/jobs/{job_id}/process")
async def process_job_route(job_id: str, worker_pool=Depends(get_worker_pool)) -> dict:
    await worker_pool.submit(lambda: process_job(job_id))
    return {"status": "accepted", "job_id": job_id}
