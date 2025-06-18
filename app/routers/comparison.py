from fastapi import APIRouter, HTTPException
from typing import List, Optional
import fastf1
import pandas as pd
import numpy as np
from ..models import TelemetryResponse, LapComparison
from ..cache import cache
from .telemetry import get_telemetry
import logging

router = APIRouter()

@router.get("/api/lap-comparison", response_model=LapComparison)
async def compare_laps(year: int, race: str, session: str, 
                      driver1: str, driver2: str, lap: int):
    cache_key = f"comparison_{year}_{race}_{session}_{driver1}_{driver2}_{lap}"
    
    cached_data = cache.get(cache_key)
    if cached_data:
        return cached_data

    try:
        # Get individual telemetry
        tel1 = await get_telemetry(year, race, session, driver1, lap)
        tel2 = await get_telemetry(year, race, session, driver2, lap)

        # Calculate delta times
        delta = {
            f"sector{i}": tel1.sector_times[i] - tel2.sector_times[i]
            for i in range(1, 4)
        }
        delta["total"] = sum(delta.values())

        response = LapComparison(
            driver1=tel1,
            driver2=tel2,
            delta=delta
        )

        cache.set(cache_key, response)
        return response

    except Exception as e:
        logging.error(f"Error comparing laps: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
