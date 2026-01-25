from collections.abc import Awaitable, Callable

from .task_queue import TaskQueue


class WorkerPool:
    def __init__(self, worker_count: int = 2) -> None:
        self._queue = TaskQueue(worker_count=worker_count)

    async def start(self) -> None:
        await self._queue.start()

    async def stop(self) -> None:
        await self._queue.stop()

    async def submit(self, task: Callable[[], Awaitable[None]]) -> None:
        await self._queue.enqueue(task)

    @property
    def queue(self) -> TaskQueue:
        return self._queue
