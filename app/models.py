from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class JobRecord(BaseModel):
    id: str
    status: str
    prompt: Optional[str] = None
    mode: Optional[str] = None
    current_workflow: Optional[Dict[str, Any]] = None
    execution_history: Optional[List[Dict[str, Any]]] = None
    config: Optional[Dict[str, Any]] = None


class JobAcceptedResponse(BaseModel):
    status: str
    job_id: str


class HealthResponse(BaseModel):
    status: str
    worker_id: Optional[str] = None
