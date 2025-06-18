from fastapi import APIRouter, HTTPException
import fastf1
from fastapi.responses import JSONResponse
import logging

router = APIRouter()

@router.get("/races/{year}")
async def get_races(year: int):
    try:
        # Get all races for the year
        races = fastf1.get_event_schedule(year)
        
        # Extract race names
        race_names = races['EventName'].tolist()
        
        # Return a direct JSON response
        return JSONResponse(content={"races": race_names})
    
    except Exception as e:
        logging.error(f"Error fetching races: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))