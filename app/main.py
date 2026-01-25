import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .api.v1 import api_router
from .background.worker_pool import WorkerPool
from .logging_config import clear_request_context, configure_logging, set_request_context
from .routers import agents, chat, health, jobs, templates, triggers, workflows
from .settings import settings
from .webhooks import router as webhooks_router

configure_logging()
logger = logging.getLogger(__name__)

worker_pool = WorkerPool(worker_count=2)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.worker_pool = worker_pool
    await worker_pool.start()
    logger.info("Worker pool started")
    yield
    await worker_pool.stop()
    logger.info("Worker pool stopped")


app = FastAPI(title="CtrlChecks Worker", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    set_request_context(request_id=request_id)
    try:
        response = await call_next(request)
    finally:
        clear_request_context()
    response.headers["x-request-id"] = request_id
    return response


app.include_router(workflows.router)
app.include_router(jobs.router)
app.include_router(agents.router)
app.include_router(chat.router)
app.include_router(templates.router)
app.include_router(triggers.router)
app.include_router(health.router)

app.include_router(api_router, prefix="/api/v1")
app.include_router(webhooks_router)
