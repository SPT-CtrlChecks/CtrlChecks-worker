import json
import logging
import time
from contextvars import ContextVar
from typing import Any, Dict

from .settings import settings

_request_context: ContextVar[Dict[str, Any]] = ContextVar("request_context", default={})


def set_request_context(**kwargs: Any) -> None:
    context = dict(_request_context.get())
    context.update({k: v for k, v in kwargs.items() if v is not None})
    _request_context.set(context)


def clear_request_context() -> None:
    _request_context.set({})


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        payload.update(_request_context.get())
        for key in ("request_id", "user_id", "job_id"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonLogFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))
