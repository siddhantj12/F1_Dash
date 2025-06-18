from fastapi import APIRouter, HTTPException
from app.models import TelemetryResponse
from app.cache import cache
import fastf1
import logging
import pandas as pd

router = APIRouter()

@router.get("/telemetry", response_model=TelemetryResponse)
async def get_telemetry(year: int, race: str, session: str, driver: str, lap: int):
    cache_key = f"{year}_{race}_{session}_{driver}_{lap}"
    
    # Check cache first
    cached_data = await cache.get(cache_key)
    if cached_data:
        return cached_data

    try:
        # Load session
        session_data = fastf1.get_session(year, race, session)
        session_data.load()

        # Get lap data
        lap_data = session_data.laps.pick_drivers([driver]).pick_laps(lap)
        
        if lap_data.empty:
            raise HTTPException(status_code=404, detail=f"No lap data found for driver {driver} on lap {lap}")
        
        # Get telemetry for the lap
        telemetry = lap_data.get_telemetry().reset_index(drop=True)
        
        # Clean data for JSON serialization
        def clean_series(series):
            return [float(x) if pd.notna(x) else 0.0 for x in series]
            
        def clean_float(value):
            return float(value) if pd.notna(value) else None
        
        # Calculate lap percentage based on distance
        max_distance = float(telemetry['Distance'].fillna(0).max() or 1)
        lap_percentage = clean_series((telemetry['Distance'] / max_distance * 100))
        
        # Process telemetry data with cleaned values
        response_dict = {
            "driver_code": session_data.get_driver(driver)['Abbreviation'],
            "telemetry": {
                "lap_percentage": lap_percentage,
                "speed": clean_series(telemetry['Speed']),
                "throttle": clean_series(telemetry['Throttle']),
                "brake": clean_series(telemetry['Brake']),
                "x": clean_series(telemetry['X']),
                "y": clean_series(telemetry['Y'])
            },
            "sector_times": {
                i: clean_float(pd.Timedelta(lap_data[f'Sector{i}Time'].iloc[0]).total_seconds())
                if not pd.isna(lap_data[f'Sector{i}Time'].iloc[0]) else None
                for i in range(1, 4)
            }
        }
        
        # Create response object
        response = TelemetryResponse(**response_dict)

        # Cache the response
        await cache.set(cache_key, response_dict)
        return response

    except Exception as e:
        logging.error(f"Error fetching telemetry: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))