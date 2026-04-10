"""Season standings route — fetches from Jolpi (Ergast mirror) API."""

import logging
import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()
logger = logging.getLogger("f1_dash")

JOLPI_BASE = "https://api.jolpi.ca/ergast/f1"


@router.get("/standings/{year}")
async def get_season_standings(year: int):
    """Return driver standings + race results for the given season."""
    async with httpx.AsyncClient(timeout=10) as client:
        standings_resp, results_resp = await _fetch_both(client, year)

    driver_standings = _parse_standings(standings_resp)
    results = _parse_results(results_resp)

    return JSONResponse({"driverStandings": driver_standings, "results": results})


async def _fetch_both(client: httpx.AsyncClient, year: int):
    import asyncio
    s, r = await asyncio.gather(
        client.get(f"{JOLPI_BASE}/{year}/driverStandings.json?limit=30"),
        client.get(f"{JOLPI_BASE}/{year}/results.json?limit=500"),
        return_exceptions=True,
    )
    return s, r


def _parse_standings(resp):
    try:
        data = resp.json()
        lists = data["MRData"]["StandingsTable"]["StandingsLists"]
        if not lists:
            return []
        return [
            {
                "code": s["Driver"].get("code", s["Driver"]["driverId"].upper()[:3]),
                "position": int(s["position"]),
                "points": float(s["points"]),
                "wins": int(s["wins"]),
                "name": f"{s['Driver']['givenName']} {s['Driver']['familyName']}",
            }
            for s in lists[0]["DriverStandings"]
        ]
    except Exception as e:
        logger.warning(f"standings parse error: {e}")
        return []


def _parse_results(resp):
    try:
        data = resp.json()
        races = data["MRData"]["RaceTable"]["Races"]
        rows = []
        for race in races:
            rnd = int(race["round"])
            for res in race.get("Results", []):
                code = res["Driver"].get("code", res["Driver"]["driverId"].upper()[:3])
                pos = int(res["position"])
                rows.append({"round": rnd, "driver": code, "position": pos})
        return rows
    except Exception as e:
        logger.warning(f"results parse error: {e}")
        return []
