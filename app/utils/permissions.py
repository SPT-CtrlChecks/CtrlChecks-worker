from typing import Iterable


def is_admin(roles: Iterable[str]) -> bool:
    return any(role == "admin" for role in roles)


def is_service_role(roles: Iterable[str]) -> bool:
    return any(role == "service" for role in roles)