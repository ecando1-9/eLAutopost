"""
Dedicated scheduler service for always-on background automation.

Run this as a standalone worker in production so posting continues even when
the API receives no traffic.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from ..core.config import logger, settings
from ..core.datetime_utils import utc_now
from .auto_generator import auto_generator_worker
from .posting import posting_worker


def build_scheduler() -> AsyncIOScheduler:
    """Create the shared background scheduler."""
    scheduler = AsyncIOScheduler(timezone="UTC")

    scheduler.add_job(
        posting_worker.process_due_posts,
        "interval",
        minutes=1,
        id="posting_worker",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
        misfire_grace_time=55,
        next_run_time=utc_now(),
    )

    scheduler.add_job(
        auto_generator_worker.process_auto_generation,
        "interval",
        minutes=15,
        id="auto_generator",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
        misfire_grace_time=300,
        next_run_time=utc_now() + timedelta(seconds=30),
    )

    return scheduler


def start_scheduler(service_name: str = "scheduler") -> AsyncIOScheduler:
    """Start the shared scheduler and log the runtime mode."""
    scheduler = build_scheduler()
    scheduler.start()
    logger.info(
        f"Background scheduler started in {service_name} mode - "
        "posting worker runs every 1 min, auto-generator every 15 mins"
    )
    return scheduler


async def run_forever() -> None:
    """Run the standalone scheduler service until the process exits."""
    logger.info(f"Starting {settings.APP_NAME} background worker")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Debug mode: {settings.DEBUG}")

    scheduler = start_scheduler(service_name="worker")
    try:
        while True:
            await asyncio.sleep(3600)
    finally:
        scheduler.shutdown()
        logger.info("Background worker shut down")


def main() -> None:
    """CLI entry point for the standalone scheduler worker."""
    try:
        asyncio.run(run_forever())
    except KeyboardInterrupt:
        logger.info("Background worker interrupted")


if __name__ == "__main__":
    main()
