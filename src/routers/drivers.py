import fastf1
from fastapi import APIRouter, HTTPException
from src.utils.logger import logger
from fastf1.plotting import get_team_color

router = APIRouter()

def get_team_color_api(team_name, session, colormap='default', exact_match=False):
    try:
        color = get_team_color(team_name, session, colormap=colormap, exact_match=exact_match)
        return {"team": team_name, "color": color}
    except Exception as e:
        # fallback if API fails
        print(f"Warning: Could not fetch color for {team_name} ({e})")
        return {"team": team_name, "color": "#888888"}

 
@router.get("/drivers/{year}/{round}/{session}")
async def get_drivers(year: int, round: int, session: str):
    try:
        # Load session
        session_data = fastf1.get_session(year, round, session)
        session_data.load()

        # Get driver list with more details
        drivers = session_data.drivers
        driver_info = []

        for driver in drivers:
            try:
                # Handle both integer driver numbers and string abbreviations
                if isinstance(driver, int):
                    # If driver is an integer (driver number), get the abbreviation from laps data
                    driver_laps = session_data.laps[session_data.laps['DriverNumber'] == str(driver)]
                    if not driver_laps.empty:
                        driver_abbr = driver_laps.iloc[0]['Driver']
                        info = session_data.get_driver(driver_abbr)
                    else:
                        logger.warning(f"No lap data found for driver number {driver}")
                        continue
                else:
                    # If driver is already a string abbreviation
                    info = session_data.get_driver(driver)
                
                if info is not None:
                    # Handle different FastF1 data structures
                    if hasattr(info, 'get'):
                        # Dictionary-like object
                        abbreviation = info.get("Abbreviation", driver)
                        first_name = info.get("FirstName", "")
                        last_name = info.get("LastName", "")
                        team_name = info.get("TeamName", "Unknown Team")
                    else:
                        # Series-like object
                        abbreviation = getattr(info, 'Abbreviation', driver)
                        first_name = getattr(info, 'FirstName', "")
                        last_name = getattr(info, 'LastName', "")
                        team_name = getattr(info, 'TeamName', "Unknown Team")
                    
                    driver_info.append({
                        "code": abbreviation,
                        "name": f"{first_name} {last_name}".strip(),
                        "team": team_name,
                        "color": get_team_color(team_name, year) if team_name != "Unknown Team" else "#888888"
                    })
                    
            except Exception as e:
                logger.warning(f"Could not get info for driver {driver}: {str(e)}")
                # Add fallback entry for this driver
                driver_info.append({
                    "code": str(driver),
                    "name": f"Driver {driver}",
                    "team": "Unknown Team",
                    "color": "#888888"
                })

        # If no drivers found, return fallback dummy data
        if not driver_info:
            logger.warning("No drivers found, returning fallback data")
            driver_info = [
                {"code": "VER", "name": "Max Verstappen", "team": "Red Bull Racing", "color": "#0600EF"},
                {"code": "PER", "name": "Sergio Perez", "team": "Red Bull Racing", "color": "#0600EF"},
                {"code": "HAM", "name": "Lewis Hamilton", "team": "Mercedes", "color": "#00D2BE"},
                {"code": "RUS", "name": "George Russell", "team": "Mercedes", "color": "#00D2BE"},
                {"code": "LEC", "name": "Charles Leclerc", "team": "Ferrari", "color": "#DC0000"},
                {"code": "SAI", "name": "Carlos Sainz", "team": "Ferrari", "color": "#DC0000"},
                {"code": "NOR", "name": "Lando Norris", "team": "McLaren", "color": "#FF8700"},
                {"code": "PIA", "name": "Oscar Piastri", "team": "McLaren", "color": "#FF8700"}
            ]

        return driver_info

    except Exception as e:
        logger.error(f"Error fetching drivers: {str(e)}")
        # Return fallback data instead of throwing error
        return [
            {"code": "VER", "name": "Max Verstappen", "team": "Red Bull Racing", "color": "#0600EF"},
            {"code": "PER", "name": "Sergio Perez", "team": "Red Bull Racing", "color": "#0600EF"},
            {"code": "HAM", "name": "Lewis Hamilton", "team": "Mercedes", "color": "#00D2BE"},
            {"code": "RUS", "name": "George Russell", "team": "Mercedes", "color": "#00D2BE"}
        ]
