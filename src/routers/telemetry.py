import fastf1
import pandas as pd
from src.cache import cache
from src.models.models import TelemetryResponse
from fastapi import APIRouter, HTTPException
from src.utils.logger import logger
from supabase_setup import supabase

router = APIRouter()


@router.get("/laps/{year}/{round}/{session}/{driver}")
async def get_laps(year: int, round: int, session: str, driver: str):
    """Get all laps for a specific driver in a session"""
    try:
        # Try Supabase RPC first
        try:
            result = supabase.rpc(
                "rpc_get_driver_laps",
                {"p_year": year, "p_round": round, "p_session": session, "p_driver_code": driver}
            ).execute()

            if result.data:
                return result.data
        except Exception as e:
            logger.warning(f"Supabase get_laps failed or timed out: {str(e)}. Falling back to FastF1.")

        # Fallback to FastF1 if Supabase returns empty
        logger.info(f"Supabase returned no laps for {driver}, falling back to FastF1")
        session_data = fastf1.get_session(year, round, session)
        session_data.load()

        driver_laps = session_data.laps.pick_drivers([driver])

        if driver_laps.empty:
            raise HTTPException(
                status_code=404,
                detail=f"No lap data found for driver {driver}",
            )

        laps_data = []
        for _, lap in driver_laps.iterrows():
            lap_data = {
                "lap": int(lap["LapNumber"]) if pd.notna(lap["LapNumber"]) else 0,
                "time": str(lap["LapTime"]) if pd.notna(lap["LapTime"]) else "N/A",
                "sector1": str(lap["Sector1Time"]) if pd.notna(lap["Sector1Time"]) else None,
                "sector2": str(lap["Sector2Time"]) if pd.notna(lap["Sector2Time"]) else None,
                "sector3": str(lap["Sector3Time"]) if pd.notna(lap["Sector3Time"]) else None,
                "compound": lap.get("Compound", "Unknown")
            }
            laps_data.append(lap_data)

        return laps_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching laps: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/telemetry/{year}/{round}/{session}/{driver}/{lap}")
async def get_telemetry(year: int, round: int, session: str, driver: str, lap: int):
    cache_key = f"{year}_{round}_{session}_{driver}_{lap}"

    # Check cache first
    cached_data = await cache.get(cache_key)
    if cached_data:
        return cached_data

    try:
        # Try Supabase RPC first
        try:
            result = supabase.rpc(
                "rpc_get_lap_telemetry",
                {"p_year": year, "p_round": round, "p_session": session, "p_driver_code": driver, "p_lap": lap}
            ).execute()

            if result.data:
                await cache.set(cache_key, result.data)
                return result.data
        except Exception as e:
            logger.warning(f"Supabase get_telemetry failed or timed out: {str(e)}. Falling back to FastF1.")

        # Fallback to FastF1 if Supabase returns empty
        logger.info(f"Supabase returned no telemetry for {driver} lap {lap}, falling back to FastF1")
        session_data = fastf1.get_session(year, round, session)
        session_data.load()

        lap_data = session_data.laps.pick_drivers([driver]).pick_laps(lap)

        if lap_data.empty:
            raise HTTPException(
                status_code=404,
                detail=f"No lap data found for driver {driver} on lap {lap}",
            )

        telemetry = lap_data.get_telemetry().reset_index(drop=True)

        telemetry_data = []
        for _, row in telemetry.iterrows():
            time_value = row.get("Time", 0)
            if pd.notna(time_value):
                if hasattr(time_value, 'total_seconds'):
                    time_float = time_value.total_seconds()
                else:
                    time_float = float(time_value)
            else:
                time_float = 0.0

            telemetry_data.append({
                "time": time_float,
                "speed": float(row.get("Speed", 0)) if pd.notna(row.get("Speed", 0)) else 0.0,
                "throttle": float(row.get("Throttle", 0)) if pd.notna(row.get("Throttle", 0)) else 0.0,
                "brake": float(row.get("Brake", 0)) if pd.notna(row.get("Brake", 0)) else 0.0,
                "gear": int(row.get("nGear", 1)) if pd.notna(row.get("nGear", 1)) else 1,
                "x": float(row.get("X", 0)) if pd.notna(row.get("X", 0)) else 0.0,
                "y": float(row.get("Y", 0)) if pd.notna(row.get("Y", 0)) else 0.0
            })

        await cache.set(cache_key, telemetry_data)
        return telemetry_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching telemetry: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/compare/{year}/{round}/{session}/{driver1}/{lap1}/{driver2}/{lap2}")
async def compare_telemetry(year: int, round: int, session: str, driver1: str, lap1: int, driver2: str, lap2: int):
    """Compare telemetry between two drivers on specific laps"""
    try:
        # Reuse get_telemetry which now tries Supabase first
        telemetry_1_data = await get_telemetry(year, round, session, driver1, lap1)
        telemetry_2_data = await get_telemetry(year, round, session, driver2, lap2)

        # Load session only for driver info and lap times
        session_data = fastf1.get_session(year, round, session)
        session_data.load()

        driver1_info = session_data.get_driver(driver1)
        driver2_info = session_data.get_driver(driver2)

        from src.routers.drivers import safe_get_team_color

        driver1_team = ""
        if driver1_info is not None and not driver1_info.empty:
            driver1_team = driver1_info.get("TeamName", "")

        driver2_team = ""
        if driver2_info is not None and not driver2_info.empty:
            driver2_team = driver2_info.get("TeamName", "")

        driver1_color = safe_get_team_color(driver1_team, session_data)
        driver2_color = safe_get_team_color(driver2_team, session_data)

        lap_time_1 = "N/A"
        lap_time_2 = "N/A"
        time_delta = 0.0

        comparison_data = {
            "driver1": {
                "code": driver1,
                "lap": lap1,
                "lapTime": lap_time_1,
                "color": driver1_color,
                "team": driver1_team,
                "data": {
                    "time": [d["time"] for d in telemetry_1_data],
                    "speed": [d["speed"] for d in telemetry_1_data],
                    "throttle": [d["throttle"] for d in telemetry_1_data],
                    "brake": [d["brake"] for d in telemetry_1_data],
                    "gear": [d["gear"] for d in telemetry_1_data]
                }
            },
            "driver2": {
                "code": driver2,
                "lap": lap2,
                "lapTime": lap_time_2,
                "color": driver2_color,
                "team": driver2_team,
                "data": {
                    "time": [d["time"] for d in telemetry_2_data],
                    "speed": [d["speed"] for d in telemetry_2_data],
                    "throttle": [d["throttle"] for d in telemetry_2_data],
                    "brake": [d["brake"] for d in telemetry_2_data],
                    "gear": [d["gear"] for d in telemetry_2_data]
                }
            },
            "delta": {
                "time": time_delta
            }
        }

        return comparison_data

    except Exception as e:
        logger.error(f"Error comparing telemetry: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/track/{year}/{round}")
async def get_track_data(year: int, round: int):
    """Get track layout data for visualization"""
    try:
        # Try Supabase RPC first
        result = supabase.rpc(
            "rpc_get_track_layout",
            {"p_year": year, "p_round": round}
        ).execute()

        if result.data:
            logger.info(f"Supabase returned track layout for {year} R{round}")
            return result.data

        # Fallback to FastF1
        logger.info(f"Supabase returned no track data, falling back to FastF1")
        session_data = fastf1.get_session(year, round, "Race")
        session_data.load()

        laps = session_data.laps
        if laps.empty:
            raise HTTPException(status_code=404, detail="No lap data found for track")

        first_lap = laps.iloc[0]
        telemetry = first_lap.get_telemetry()

        circuit_info = session_data.event
        circuit_name = circuit_info.get('EventName', 'Unknown Circuit')

        track_data = {
            "circuit_name": circuit_name,
            "coordinates": {
                "x": [float(x) if pd.notna(x) else 0.0 for x in telemetry["X"]],
                "y": [float(y) if pd.notna(y) else 0.0 for y in telemetry["Y"]],
                "distance": [float(d) if pd.notna(d) else 0.0 for d in telemetry["Distance"]]
            },
            "sector_boundaries": []
        }

        return track_data

    except Exception as e:
        logger.error(f"Error fetching track data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
