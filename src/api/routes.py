from fastapi import APIRouter, HTTPException
import fastf1
import logging
from typing import List, Dict, Any
from ..utils.team_colors import get_team_color

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("f1-dash")

# Configure FastF1 cache
fastf1.Cache.enable_cache('fastf1_cache')

router = APIRouter()

@router.get("/seasons")
async def get_seasons() -> List[int]:
    """Get available seasons"""
    try:
        return list(range(2018, 2026))
    except Exception as e:
        logger.error(f"Error getting seasons: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/races/{year}")
async def get_races(year: int) -> List[Dict[str, Any]]:
    """Get races for a specific season"""
    try:
        schedule = fastf1.get_event_schedule(year)
        races = []
        for _, race in schedule.iterrows():
            races.append({
                "round": int(race['RoundNumber']),
                "name": race['EventName'],
                "circuit": race['Location'] if 'Location' in race else race['EventName'],
                "date": race['EventDate'].strftime("%Y-%m-%d")
            })
        return races
    except Exception as e:
        logger.error(f"Error getting races for year {year}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions/{year}/{round}")
async def get_sessions(year: int, round: int) -> List[str]:
    """Get sessions for a specific race"""
    try:
        try:
            event = fastf1.get_event(year, round)
            sessions = []
            for session_name in event.get_session_names():
                sessions.append(session_name)
            
            if not sessions:
                sessions = ["Practice 1", "Practice 2", "Practice 3", "Qualifying", "Race"]
        except Exception:
            sessions = ["Practice 1", "Practice 2", "Practice 3", "Qualifying", "Race"]
            
        return sessions
    except Exception as e:
        logger.error(f"Error getting sessions for year {year}, round {round}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/drivers/{year}/{round}/{session}")
async def get_drivers(year: int, round: int, session: str) -> List[Dict[str, Any]]:
    """Get drivers for a specific session"""
    try:
        try:
            session_data = fastf1.get_session(year, round, session)
            session_data.load()
            
            drivers = []
            for driver in session_data.drivers:
                driver_info = session_data.get_driver(driver)
                team_name = driver_info['TeamName']
                drivers.append({
                    "code": driver,
                    "number": driver_info['DriverNumber'],
                    "name": f"{driver_info['FirstName']} {driver_info['LastName']}",
                    "team": team_name,
                    "color": get_team_color(team_name)
                })
            return drivers
            
        except Exception as e:
            logger.warning(f"Error loading drivers from session data: {str(e)}. Using dummy data.")
            return [
                {"code": "VER", "number": "1", "name": "Max Verstappen", "team": "Red Bull Racing", "color": get_team_color("Red Bull Racing")},
                {"code": "PER", "number": "11", "name": "Sergio Perez", "team": "Red Bull Racing", "color": get_team_color("Red Bull Racing")},
                {"code": "HAM", "number": "44", "name": "Lewis Hamilton", "team": "Mercedes", "color": get_team_color("Mercedes")},
                {"code": "RUS", "number": "63", "name": "George Russell", "team": "Mercedes", "color": get_team_color("Mercedes")},
                {"code": "LEC", "number": "16", "name": "Charles Leclerc", "team": "Ferrari", "color": get_team_color("Ferrari")},
                {"code": "SAI", "number": "55", "name": "Carlos Sainz", "team": "Ferrari", "color": get_team_color("Ferrari")},
                {"code": "NOR", "number": "4", "name": "Lando Norris", "team": "McLaren", "color": get_team_color("McLaren")},
                {"code": "PIA", "number": "81", "name": "Oscar Piastri", "team": "McLaren", "color": get_team_color("McLaren")}
            ]
    except Exception as e:
        logger.error(f"Error getting drivers for {year} {round} {session}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 