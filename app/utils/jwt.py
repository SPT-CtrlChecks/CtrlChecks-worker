from typing import Any, Dict, Optional

import jwt

from ..settings import settings


def _normalize_public_key(public_key: Optional[str]) -> Optional[str]:
    if not public_key:
        return None
    if "BEGIN PUBLIC KEY" in public_key:
        return public_key
    return f"-----BEGIN PUBLIC KEY-----\n{public_key}\n-----END PUBLIC KEY-----"


def decode_jwt(token: str) -> Dict[str, Any]:
    """Decode JWT token. Raises ValueError if keys not configured."""
    public_key = _normalize_public_key(settings.supabase_jwt_public_key)
    if public_key:
        return jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    if settings.supabase_jwt_secret:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    raise ValueError("Supabase JWT key not configured. Set either SUPABASE_JWT_PUBLIC_KEY or SUPABASE_JWT_SECRET in .env")
