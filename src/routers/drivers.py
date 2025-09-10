import fastf1
from fastapi import APIRouter, HTTPException
from src.utils.logger import logger

router = APIRouter()

# Team color mapping for different years
TEAM_COLORS = {
    2024: {
        "Mercedes": "#00D2BE",
        "Red Bull Racing": "#0600EF", 
        "Ferrari": "#DC0000",
        "McLaren": "#FF8700",
        "Alpine": "#0090FF",
        "Aston Martin": "#006F62",
        "Williams": "#005AFF",
        "RB": "#6592ff",
        "Kick Sauber": "#52E252",
        "Haas F1 Team": "#FFFFFF"
    },
    2023: {
        "Mercedes": "#00D2BE",
        "Red Bull Racing": "#0600EF",
        "Ferrari": "#DC0000", 
        "McLaren": "#FF8700",
        "Alpine": "#0090FF",
        "Aston Martin": "#006F62",
        "Williams": "#005AFF",
        "AlphaTauri": "#2B4562",
        "Alfa Romeo": "#900000",
        "Haas F1 Team": "#FFFFFF"
    },
    2022: {
        "Mercedes": "#00D2BE",
        "Red Bull Racing": "#0600EF",
        "Ferrari": "#DC0000",
        "McLaren": "#FF8700", 
        "Alpine": "#0090FF",
        "Aston Martin": "#006F62",
        "Williams": "#005AFF",
        "AlphaTauri": "#2B4562",
        "Alfa Romeo": "#900000",
        "Haas F1 Team": "#FFFFFF"
    },
    2021: {
        "Mercedes": "#00D2BE",
        "Red Bull Racing": "#0600EF",
        "Ferrari": "#DC0000",
        "McLaren": "#FF8700",
        "Alpine": "#0090FF",
        "Aston Martin": "#006F62", 
        "Williams": "#005AFF",
        "AlphaTauri": "#2B4562",
        "Alfa Romeo": "#900000",
        "Haas F1 Team": "#FFFFFF"
    }
}

def get_team_color(team_name, year):
    """Get team color for a specific year"""
    year_colors = TEAM_COLORS.get(year, TEAM_COLORS.get(2024, {}))
    return year_colors.get(team_name, "#888888")

 
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
