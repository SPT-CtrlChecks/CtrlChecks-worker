import asyncio
import logging
from collections.abc import Awaitable, Callable

logger = logging.getLogger(__name__)

JobCallable = Callable[[], Awaitable[None]]


class TaskQueue:
    def __init__(self, worker_count: int = 2) -> None:
        self._queue: asyncio.Queue[JobCallable] = asyncio.Queue()
        self._workers: list[asyncio.Task] = []
        self._worker_count = worker_count
        self._stop_event = asyncio.Event()

    async def start(self) -> None:
        self._stop_event.clear()
        for idx in range(self._worker_count):
            self._workers.append(asyncio.create_task(self._worker_loop(idx)))
        logger.info("Task queue started", extra={"worker_count": self._worker_count})

    async def stop(self) -> None:
        self._stop_event.set()
        for _ in self._workers:
            await self._queue.put(self._noop)
        await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()
        logger.info("Task queue stopped")

    async def enqueue(self, job: JobCallable) -> None:
        await self._queue.put(job)

    async def _worker_loop(self, idx: int) -> None:
        while not self._stop_event.is_set():
            job = await self._queue.get()
            try:
                await job()
            except Exception as exc:  # noqa: BLE001
                logger.exception("Background task failed", extra={"worker_idx": idx, "error": str(exc)})
            finally:
                self._queue.task_done()

    async def _noop(self) -> None:
        return None
