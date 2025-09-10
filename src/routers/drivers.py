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
                info = session_data.get_driver(driver)
                if info is not None and "Abbreviation" in info:
                    team_name = info.get("TeamName", "")
                    driver_info.append({
                        "code": info["Abbreviation"],
                        "name": f"{info.get('FirstName', '')} {info.get('LastName', '')}".strip(),
                        "team": team_name,
                        "color": get_team_color(team_name, year)
                    })
            except Exception as e:
                logger.warning(f"Could not get info for driver {driver}: {str(e)}")

        return driver_info

    except Exception as e:
        logger.error(f"Error fetching drivers: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
