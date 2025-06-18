from fastapi import APIRouter, WebSocket
from ..services.websocket import manager
from ..cache import cache
import asyncio

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
    except:
        manager.disconnect(websocket)