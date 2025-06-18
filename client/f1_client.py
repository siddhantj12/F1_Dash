import aiohttp
import asyncio
from typing import Dict, Any

class F1Client:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = None
    
    async def _ensure_session(self):
        if self.session is None:
            self.session = aiohttp.ClientSession()
    
    async def get_races(self, year: int) -> Dict[str, Any]:
        await self._ensure_session()
        async with self.session.get(f"{self.base_url}/api/races/{year}") as response:
            response.raise_for_status()
            return await response.json()

    async def get_telemetry(self, year: int, race: str, session: str, 
                           driver: str, lap: int) -> Dict[str, Any]:
        await self._ensure_session()
        async with self.session.get(
            f"{self.base_url}/api/telemetry",
            params={"year": year, "race": race, "session": session, 
                   "driver": driver, "lap": lap}
        ) as response:
            response.raise_for_status()
            return await response.json()

    async def compare_laps(self, year: int, race: str, session: str,
                          driver1: str, driver2: str, lap: int) -> Dict[str, Any]:
        await self._ensure_session()
        async with self.session.get(
            f"{self.base_url}/api/lap-comparison",
            params={"year": year, "race": race, "session": session,
                   "driver1": driver1, "driver2": driver2, "lap": lap}
        ) as response:
            response.raise_for_status()
            return await response.json()
            
    async def close(self):
        if self.session:
            await self.session.close()
            self.session = None