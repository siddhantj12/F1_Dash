from fastapi import APIRouter, HTTPException
import fastf1
import logging

router = APIRouter()

@router.get("/drivers")
async def get_drivers(year: int, race: str, session: str):
    try:
        # Load session
        session_data = fastf1.get_session(year, race, session)
        session_data.load()
        
        # Get driver list - convert to list of strings
        drivers = session_data.drivers
        driver_info = []
        
        for driver in drivers:
            try:
                info = session_data.get_driver(driver)
                if info is not None and 'Abbreviation' in info:
                    driver_info.append(info['Abbreviation'])
            except Exception as e:
                logging.warning(f"Could not get info for driver {driver}: {str(e)}")
        
        return {"drivers": driver_info}
    
    except Exception as e:
        logging.error(f"Error fetching drivers: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))