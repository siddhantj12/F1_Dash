import fastf1
from fastapi import APIRouter, HTTPException
from src.utils.logger import logger
from fastf1.plotting import get_team_color  # Use FastF1's robust color system
from supabase_setup import supabase

router = APIRouter()


def get_driver_code_from_number(session_data, driver_number):
    """Extract driver code from driver number using multiple methods"""
    try:
        if hasattr(session_data, 'laps') and not session_data.laps.empty:
            driver_laps = session_data.laps[session_data.laps['DriverNumber'] == str(driver_number)]
            if not driver_laps.empty:
                return driver_laps.iloc[0]['Driver']

        if hasattr(session_data, 'results') and not session_data.results.empty:
            driver_results = session_data.results[session_data.results['DriverNumber'] == str(driver_number)]
            if not driver_results.empty:
                return driver_results.iloc[0]['Abbreviation']
    except Exception as e:
        logger.warning(f"Error extracting driver code for number {driver_number}: {e}")

    return None


def get_driver_info_from_laps(session_data, driver_code):
    """Extract driver info from laps data"""
    try:
        driver_laps = session_data.laps[session_data.laps['Driver'] == driver_code]
        if not driver_laps.empty:
            first_lap = driver_laps.iloc[0]
            return {
                'code': driver_code,
                'team': first_lap.get('Team', 'Unknown Team'),
                'driver_number': first_lap.get('DriverNumber', '')
            }
    except Exception as e:
        logger.warning(f"Could not get info from laps for {driver_code}: {e}")
    return None


def get_driver_info_from_results(session_data, driver_code):
    """Extract driver info from results data"""
    try:
        if hasattr(session_data, 'results') and not session_data.results.empty:
            driver_results = session_data.results[session_data.results['Abbreviation'] == driver_code]
            if not driver_results.empty:
                result = driver_results.iloc[0]
                return {
                    'code': driver_code,
                    'team': result.get('TeamName', 'Unknown Team'),
                    'full_name': result.get('FullName', f'Driver {driver_code}'),
                    'driver_number': result.get('DriverNumber', '')
                }
    except Exception as e:
        logger.warning(f"Could not get info from results for {driver_code}: {e}")
    return None


def safe_get_team_color(team_name, session_data):
    """Safely get team color using FastF1's robust color system"""
    try:
        color = get_team_color(team_name, session_data, colormap='default', exact_match=False)
        return color
    except Exception as e:
        logger.warning(f"Could not get FastF1 color for team {team_name}: {e}")

        fallback_colors = {
            'Red Bull Racing': '#3671C6',
            'Mercedes': '#6CD3BF',
            'Ferrari': '#F91536',
            'McLaren': '#F58020',
            'Aston Martin': '#358C75',
            'Alpine': '#2293D1',
            'Williams': '#37BEDD',
            'RB': '#6692FF',
            'Kick Sauber': '#52E252',
            'Haas F1 Team': '#B6BABD'
        }

        color = fallback_colors.get(team_name)
        if color:
            return color

        for team, color in fallback_colors.items():
            if team.lower() in team_name.lower() or team_name.lower() in team.lower():
                return color

        return '#888888'


def get_driver_name_fallback(driver_code):
    """Fallback driver names for 2024 season"""
    driver_names = {
        "VER": "Max Verstappen", "PER": "Sergio Perez",
        "HAM": "Lewis Hamilton", "RUS": "George Russell",
        "LEC": "Charles Leclerc", "SAI": "Carlos Sainz",
        "NOR": "Lando Norris", "PIA": "Oscar Piastri",
        "ALO": "Fernando Alonso", "STR": "Lance Stroll",
        "GAS": "Pierre Gasly", "OCO": "Esteban Ocon",
        "ALB": "Alexander Albon", "SAR": "Logan Sargeant",
        "TSU": "Yuki Tsunoda", "RIC": "Daniel Ricciardo",
        "BOT": "Valtteri Bottas", "ZHO": "Guanyu Zhou",
        "MAG": "Kevin Magnussen", "HUL": "Nico Hulkenberg"
    }
    return driver_names.get(driver_code, f"Driver {driver_code}")


@router.get("/drivers/{year}/{round}/{session}")
async def get_drivers(year: int, round: int, session: str):
    try:
        # Try Supabase RPC first
        result = supabase.rpc(
            "rpc_get_drivers",
            {"p_year": year, "p_round": round, "p_session": session}
        ).execute()

        if result.data:
            logger.info(f"Supabase returned {len(result.data)} drivers for {year}/{round}/{session}")
            return result.data

        # Fallback to FastF1
        logger.info(f"Supabase returned no drivers, falling back to FastF1")
        session_data = fastf1.get_session(year, round, session)
        session_data.load()

        driver_info = []
        processed_drivers = set()

        # Method 1: Extract from laps data
        try:
            if hasattr(session_data, 'laps') and not session_data.laps.empty:
                unique_drivers = session_data.laps['Driver'].unique()
                logger.info(f"Found {len(unique_drivers)} unique drivers in laps data")

                for driver_code in unique_drivers:
                    if driver_code not in processed_drivers:
                        driver_data = get_driver_info_from_laps(session_data, driver_code)

                        if driver_data:
                            team_name = driver_data['team']
                            result_info = get_driver_info_from_results(session_data, driver_code)
                            full_name = result_info['full_name'] if result_info else get_driver_name_fallback(driver_code)
                            team_color = safe_get_team_color(team_name, session_data)

                            driver_info.append({
                                "code": driver_code,
                                "name": full_name,
                                "team": team_name,
                                "color": team_color
                            })
                            processed_drivers.add(driver_code)

        except Exception as e:
            logger.warning(f"Could not extract drivers from laps: {e}")

        # Method 2: Extract from results data (fallback)
        if not driver_info:
            try:
                if hasattr(session_data, 'results') and not session_data.results.empty:
                    for _, res in session_data.results.iterrows():
                        driver_code = res.get('Abbreviation', '')
                        if driver_code and driver_code not in processed_drivers:
                            team_name = res.get('TeamName', 'Unknown Team')
                            full_name = res.get('FullName', get_driver_name_fallback(driver_code))
                            team_color = safe_get_team_color(team_name, session_data)

                            driver_info.append({
                                "code": driver_code,
                                "name": full_name,
                                "team": team_name,
                                "color": team_color
                            })
                            processed_drivers.add(driver_code)

            except Exception as e:
                logger.warning(f"Could not extract drivers from results: {e}")

        # Method 3: Handle integer driver numbers
        if not driver_info and hasattr(session_data, 'drivers'):
            for driver in session_data.drivers:
                if isinstance(driver, int):
                    driver_code = get_driver_code_from_number(session_data, driver)
                    if driver_code and driver_code not in processed_drivers:
                        driver_data = get_driver_info_from_laps(session_data, driver_code)
                        if not driver_data:
                            driver_data = get_driver_info_from_results(session_data, driver_code)

                        if driver_data:
                            team_name = driver_data.get('team', 'Unknown Team')
                            full_name = driver_data.get('full_name', get_driver_name_fallback(driver_code))
                            team_color = safe_get_team_color(team_name, session_data)

                            driver_info.append({
                                "code": driver_code,
                                "name": full_name,
                                "team": team_name,
                                "color": team_color
                            })
                            processed_drivers.add(driver_code)

        # Final fallback
        if not driver_info:
            logger.warning("No drivers found, using fallback")
            fallback_drivers = [
                {"code": "VER", "name": "Max Verstappen", "team": "Red Bull Racing"},
                {"code": "PER", "name": "Sergio Perez", "team": "Red Bull Racing"},
                {"code": "HAM", "name": "Lewis Hamilton", "team": "Mercedes"},
                {"code": "RUS", "name": "George Russell", "team": "Mercedes"},
                {"code": "LEC", "name": "Charles Leclerc", "team": "Ferrari"},
                {"code": "SAI", "name": "Carlos Sainz", "team": "Ferrari"},
                {"code": "NOR", "name": "Lando Norris", "team": "McLaren"},
                {"code": "PIA", "name": "Oscar Piastri", "team": "McLaren"}
            ]

            for driver in fallback_drivers:
                driver["color"] = safe_get_team_color(driver["team"], session_data)

            driver_info = fallback_drivers

        logger.info(f"Successfully retrieved {len(driver_info)} drivers for {year}/{round}/{session}")
        return driver_info

    except Exception as e:
        logger.error(f"Error fetching drivers: {str(e)}")
        fallback_drivers = [
            {"code": "VER", "name": "Max Verstappen", "team": "Red Bull Racing", "color": "#3671C6"},
            {"code": "HAM", "name": "Lewis Hamilton", "team": "Mercedes", "color": "#6CD3BF"},
            {"code": "LEC", "name": "Charles Leclerc", "team": "Ferrari", "color": "#F91536"},
            {"code": "NOR", "name": "Lando Norris", "team": "McLaren", "color": "#F58020"}
        ]
        return fallback_drivers
