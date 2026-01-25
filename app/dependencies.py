from typing import Optional

from fastapi import Depends, Header, Request

from .auth import UserContext, get_user_from_token
from .settings import settings
from .utils.errors import http_error
from .utils.permissions import is_admin


def _extract_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise http_error(401, "Unauthorized")
    token = authorization.replace("Bearer ", "").replace("bearer ", "").strip()
    if not token:
        raise http_error(401, "Unauthorized")
    return token


def get_current_user(authorization: Optional[str] = Header(default=None)) -> UserContext:
    token = _extract_token(authorization)
    try:
        return get_user_from_token(token)
    except Exception as exc:  # noqa: BLE001
        raise http_error(401, "Unauthorized", str(exc)) from exc


def get_optional_user(authorization: Optional[str] = Header(default=None)) -> UserContext | None:
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").replace("bearer ", "").strip()
    if not token:
        return None
    try:
        return get_user_from_token(token)
    except Exception as exc:  # noqa: BLE001
        raise http_error(401, "Unauthorized", str(exc)) from exc


def require_admin(user: UserContext = Depends(get_current_user)) -> UserContext:
    if not is_admin(user.roles):
        raise http_error(403, "Admin access required")
    return user


def require_service_role(
    x_service_role_key: Optional[str] = Header(default=None, alias="x-service-role-key"),
    authorization: Optional[str] = Header(default=None),
) -> None:
    candidate = x_service_role_key
    if not candidate and authorization:
        candidate = authorization.replace("Bearer ", "").replace("bearer ", "").strip()
    if not candidate or candidate != settings.supabase_service_role_key:
        raise http_error(403, "Service role required")


def get_worker_pool(request: Request):
    return request.app.state.worker_pool
