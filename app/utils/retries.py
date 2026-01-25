from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from ..settings import settings


def retry_configured():
    return retry(
        retry=retry_if_exception_type(Exception),
        stop=stop_after_attempt(settings.max_retries),
        wait=wait_exponential(
            min=settings.retry_base_seconds,
            max=settings.retry_max_seconds,
        ),
        reraise=True,
    )
