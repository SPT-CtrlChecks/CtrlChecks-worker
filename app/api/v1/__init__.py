from fastapi import APIRouter

from . import admin, agent, chat, llm, templates, triggers, workflow

api_router = APIRouter()
api_router.include_router(workflow.router, prefix="/workflows")
api_router.include_router(chat.router, prefix="/chat")
api_router.include_router(agent.router, prefix="/agents")
api_router.include_router(triggers.router, prefix="/triggers")
api_router.include_router(templates.router, prefix="/templates")
api_router.include_router(admin.router, prefix="/admin")
api_router.include_router(llm.router, prefix="/llm")
