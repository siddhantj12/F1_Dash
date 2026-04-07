import logging

import fastf1
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from supabase_setup import supabase

router = APIRouter()


@router.get("/seasons")
async def get_seasons():
    """Get available seasons/years"""
    try:
        # Try Supabase first
        result = supabase.rpc("rpc_get_seasons").execute()

        if result.data:
            return JSONResponse(content=result.data)

        # Fallback to hardcoded list if Supabase empty
        logging.info("Supabase returned no seasons, using fallback list")
        available_seasons = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
        return JSONResponse(content=available_seasons)

    except Exception as e:
        logging.error(f"Error fetching seasons: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/races/{year}")
async def get_races(year: int):
    try:
        # Try Supabase first
        result = supabase.rpc("rpc_get_races", {"p_year": year}).execute()

        if result.data:
            # Ensure races are sorted in chronological order
            sorted_data = sorted(result.data, key=lambda x: x.get("round", 0))
            return JSONResponse(content=sorted_data)

        # Fallback to FastF1
        logging.info(f"Supabase returned no races for {year}, falling back to FastF1")
        races = fastf1.get_event_schedule(year)

        race_list = []
        for index, race in races.iterrows():
            race_list.append({
                "round": race.get("RoundNumber", index + 1),
                "name": race.get("EventName", ""),
                "circuit": race.get("Location", ""),
                "date": race.get("EventDate", "").strftime("%Y-%m-%d") if race.get("EventDate") else ""
            })

        return JSONResponse(content=race_list)

    except Exception as e:
        logging.error(f"Error fetching races: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{year}/{round}")
async def get_sessions(year: int, round: int):
    """Get available sessions for a race"""
    try:
        # Try Supabase first
        result = supabase.rpc("rpc_get_sessions", {"p_year": year, "p_round": round}).execute()

        if result.data:
            return JSONResponse(content=result.data)

        # Fallback to FastF1
        logging.info(f"Supabase returned no sessions for {year} R{round}, falling back to FastF1")
        races = fastf1.get_event_schedule(year)

        race = races[races.index == round - 1]
        if race.empty:
            raise HTTPException(status_code=404, detail="Race not found")

        available_sessions = ["Practice 1", "Practice 2", "Practice 3", "Qualifying", "Race"]
        return JSONResponse(content=available_sessions)

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching sessions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
