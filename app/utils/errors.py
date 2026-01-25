from typing import Any, Dict

from fastapi import HTTPException


def http_error(status_code: int, message: str, details: Any | None = None) -> HTTPException:
    payload: Dict[str, Any] = {"error": message}
    if details is not None:
        payload["details"] = details
    return HTTPException(status_code=status_code, detail=payload)


def unauthorized(detail: str = "Unauthorized") -> HTTPException:
    return HTTPException(status_code=401, detail=detail)


def forbidden(detail: str = "Forbidden") -> HTTPException:
    return HTTPException(status_code=403, detail=detail)


def bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=400, detail=detail)


def not_found(detail: str = "Not found") -> HTTPException:
    return HTTPException(status_code=404, detail=detail)
