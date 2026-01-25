from __future__ import annotations

from functools import lru_cache
from typing import Callable, TypeVar

from supabase import Client, create_client

from .settings import settings
from .utils.retries import retry_configured

T = TypeVar("T")


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def execute_with_retry(action: Callable[[], T]) -> T:
    wrapped = retry_configured()(action)
    return wrapped()

