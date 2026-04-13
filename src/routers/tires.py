from typing import List

import fastf1
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from src.utils.logger import logger
from supabase_setup import supabase

router = APIRouter()


class TireStint(BaseModel):
    lap: int
    compound: str


class TireHistory(BaseModel):
    driver: str
    tires: List[TireStint]


@router.get(
    "/tire-compound/{year}/{race}/{session}/{driver}", response_model=TireHistory
)
async def get_tire_compounds(year: int, race: str, session: str, driver: str):
    try:
        # Try Supabase RPC first
        result = supabase.rpc(
            "rpc_get_tire_history",
            {"p_year": year, "p_round": int(race), "p_session": session, "p_driver_code": driver}
        ).execute()

        if result.data and result.data.get("tires"):
            logger.info(f"Supabase returned tire history for {driver}")
            return TireHistory(driver=result.data["driver"], tires=result.data["tires"])

        # Fallback to FastF1
        logger.info(f"Supabase returned no tire data, falling back to FastF1")
        session_data = fastf1.get_session(year, race, session)
        session_data.load()

        driver_laps = session_data.laps.pick_driver(driver)

        tire_stints = []
        current_compound = None

        for _, lap in driver_laps.iterrows():
            if lap["Compound"] != current_compound:
                current_compound = lap["Compound"]
                tire_stints.append(
                    TireStint(lap=int(lap["LapNumber"]), compound=current_compound)
                )

        return TireHistory(driver=driver, tires=tire_stints)

    except Exception as e:
        logger.error(f"Error fetching tire compounds: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
