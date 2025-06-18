import asyncio
from fastf1.core import Session
from .telemetry_service import telemetry_service
import logging

async def update_positions_task(session_data: Session):
    while True:
        try:
            session_data.load()  # Refresh data
            await telemetry_service.update_live_positions(session_data)
            await asyncio.sleep(10)  # Update every 10 seconds
        except Exception as e:
            logging.error(f"Error updating positions: {e}")
            await asyncio.sleep(5)  # Wait before retrying