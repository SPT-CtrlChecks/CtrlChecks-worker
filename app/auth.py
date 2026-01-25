import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .supabase_client import get_supabase_client
from .utils.jwt import decode_jwt

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class UserContext:
    user_id: str
    email: Optional[str]
    roles: List[str]
    profile: Optional[Dict[str, Any]]


def get_user_from_token(token: str) -> UserContext:
    payload = decode_jwt(token)
    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id:
        raise ValueError("Invalid token payload")

    supabase = get_supabase_client()
    profile = None
    roles: List[str] = []

    try:
        profile_response = (
            supabase.table("profiles")
            .select("*")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        profile = profile_response.data
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to load profile", extra={"user_id": user_id, "error": str(exc)})

    try:
        roles_response = (
            supabase.table("user_roles")
            .select("role")
            .eq("user_id", user_id)
            .execute()
        )
        roles = [row["role"] for row in (roles_response.data or []) if "role" in row]
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to load roles", extra={"user_id": user_id, "error": str(exc)})

    return UserContext(user_id=user_id, email=email, roles=roles, profile=profile)
