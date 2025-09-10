import logging

import fastf1
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/seasons")
async def get_seasons():
    """Get available seasons/years"""
    try:
        # Return available seasons - you can customize this list based on your data
        available_seasons = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
        return JSONResponse(content=available_seasons)
    except Exception as e:
        logging.error(f"Error fetching seasons: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/races/{year}")
async def get_races(year: int):
    try:
        # Get all races for the year
        races = fastf1.get_event_schedule(year)

        # Create race list with round numbers and details
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
        # Get the race schedule
        races = fastf1.get_event_schedule(year)
        
        # Find the race by round number
        race = races[races.index == round - 1]  # Round is 1-based, index is 0-based
        if race.empty:
            raise HTTPException(status_code=404, detail="Race not found")
        
        # Common F1 sessions
        available_sessions = ["Practice 1", "Practice 2", "Practice 3", "Qualifying", "Race"]
        
        return JSONResponse(content=available_sessions)
        
    except Exception as e:
        logging.error(f"Error fetching sessions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
