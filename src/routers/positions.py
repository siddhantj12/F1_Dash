import asyncio

from fastapi import APIRouter, WebSocket

from ..cache import cache
from ..services.websocket import manager
from src.utils.logger import logger

router = APIRouter()


@router.websocket("/ws/positions")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Get latest position data
            positions = await cache.get("latest_positions")
            if positions:
                await websocket.send_json(positions)
            await asyncio.sleep(10)  # Update every 10 seconds
    except Exception as e:
        logger.error(f"WebSocket error in /ws/positions: {e}")
        manager.disconnect(websocket)
