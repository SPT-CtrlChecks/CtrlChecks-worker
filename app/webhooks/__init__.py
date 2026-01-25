import hashlib
import hmac

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from ..dependencies import require_service_role
from ..services.triggers import webhook_trigger
from ..settings import settings

router = APIRouter(tags=["webhooks"])


def _verify_signature(signature: str | None, body: bytes) -> bool:
    if not settings.webhook_secret:
        return True
    if not signature:
        return False
    expected = hmac.new(settings.webhook_secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    if signature.startswith("sha256="):
        signature = signature.split("=", 1)[-1]
    return hmac.compare_digest(signature, expected)


@router.api_route("/webhooks/{hook_type}", methods=["POST", "OPTIONS"])
async def webhook_dispatch(
    request: Request, hook_type: str, _service=Depends(require_service_role)
) -> JSONResponse:
    body = await request.body()
    signature = request.headers.get("x-webhook-signature") or request.headers.get("x-signature")
    if not _verify_signature(signature, body):
        return JSONResponse({"error": "Invalid webhook signature"}, status_code=401)

    return await webhook_trigger(request)
