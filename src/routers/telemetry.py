import fastf1
import pandas as pd
from src.cache import cache
from src.models.models import TelemetryResponse
from fastapi import APIRouter, HTTPException
from src.utils.logger import logger
from supabase_setup import supabase

# Preserve built-in round — FastAPI path params named 'round' shadow it
_round = round

# ---------------------------------------------------------------------------
# In-process session cache — avoids re-loading the same FastF1 session
# within the same server process (works even without Redis)
# ---------------------------------------------------------------------------
_SESSION_CACHE: dict = {}   # key → fastf1.core.Session
_COMPARE_CACHE: dict = {}   # key → full compare response dict
_MAX_SESSIONS = 5           # keep at most 5 sessions in memory


def _get_cached_session(key: str):
    return _SESSION_CACHE.get(key)


def _put_session(key: str, session):
    if len(_SESSION_CACHE) >= _MAX_SESSIONS:
        # evict oldest entry
        oldest = next(iter(_SESSION_CACHE))
        del _SESSION_CACHE[oldest]
    _SESSION_CACHE[key] = session


def _session_key(year, round, session_name) -> str:
    return f"{year}_{round}_{session_name}"

router = APIRouter()


@router.get("/laps/{year}/{round}/{session}/{driver}")
async def get_laps(year: int, round: int, session: str, driver: str):
    """Get all laps for a specific driver in a session"""
    try:
        # Try Supabase RPC first
        try:
            result = supabase.rpc(
                "rpc_get_driver_laps",
                {"p_year": year, "p_round": round, "p_session": session, "p_driver_code": driver}
            ).execute()

            if result.data:
                return result.data
        except Exception as e:
            logger.warning(f"Supabase get_laps failed or timed out: {str(e)}. Falling back to FastF1.")

        # Fallback to FastF1 if Supabase returns empty
        logger.info(f"Supabase returned no laps for {driver}, falling back to FastF1")
        session_data = fastf1.get_session(year, round, session)
        session_data.load()

        driver_laps = session_data.laps.pick_drivers([driver])

        if driver_laps.empty:
            raise HTTPException(
                status_code=404,
                detail=f"No lap data found for driver {driver}",
            )

        laps_data = []
        for _, lap in driver_laps.iterrows():
            lap_data = {
                "lap": int(lap["LapNumber"]) if pd.notna(lap["LapNumber"]) else 0,
                "time": str(lap["LapTime"]) if pd.notna(lap["LapTime"]) else "N/A",
                "sector1": str(lap["Sector1Time"]) if pd.notna(lap["Sector1Time"]) else None,
                "sector2": str(lap["Sector2Time"]) if pd.notna(lap["Sector2Time"]) else None,
                "sector3": str(lap["Sector3Time"]) if pd.notna(lap["Sector3Time"]) else None,
                "compound": lap.get("Compound", "Unknown")
            }
            laps_data.append(lap_data)

        return laps_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching laps: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/telemetry/{year}/{round}/{session}/{driver}/{lap}")
async def get_telemetry(year: int, round: int, session: str, driver: str, lap: int):
    cache_key = f"{year}_{round}_{session}_{driver}_{lap}"

    # Check cache first
    cached_data = await cache.get(cache_key)
    if cached_data:
        return cached_data

    try:
        # Try Supabase RPC first
        try:
            result = supabase.rpc(
                "rpc_get_lap_telemetry",
                {"p_year": year, "p_round": round, "p_session": session, "p_driver_code": driver, "p_lap": lap}
            ).execute()

            if result.data:
                await cache.set(cache_key, result.data)
                return result.data
        except Exception as e:
            logger.warning(f"Supabase get_telemetry failed or timed out: {str(e)}. Falling back to FastF1.")

        # Fallback to FastF1 if Supabase returns empty
        logger.info(f"Supabase returned no telemetry for {driver} lap {lap}, falling back to FastF1")
        sk = _session_key(year, round, session)
        session_data = _get_cached_session(sk)
        if session_data is None:
            session_data = fastf1.get_session(year, round, session)
            session_data.load()
            _put_session(sk, session_data)
        elif not hasattr(session_data, '_telemetry_loaded'):
            session_data.load()
            session_data._telemetry_loaded = True

        lap_data = session_data.laps.pick_drivers([driver]).pick_laps(lap)

        if lap_data.empty:
            raise HTTPException(
                status_code=404,
                detail=f"No lap data found for driver {driver} on lap {lap}",
            )

        telemetry = lap_data.get_telemetry().reset_index(drop=True)

        telemetry_data = []
        for _, row in telemetry.iterrows():
            time_value = row.get("Time", 0)
            if pd.notna(time_value):
                if hasattr(time_value, 'total_seconds'):
                    time_float = time_value.total_seconds()
                else:
                    time_float = float(time_value)
            else:
                time_float = 0.0

            telemetry_data.append({
                "time": time_float,
                "speed": float(row.get("Speed", 0)) if pd.notna(row.get("Speed", 0)) else 0.0,
                "throttle": float(row.get("Throttle", 0)) if pd.notna(row.get("Throttle", 0)) else 0.0,
                "brake": float(row.get("Brake", 0)) if pd.notna(row.get("Brake", 0)) else 0.0,
                "gear": int(row.get("nGear", 1)) if pd.notna(row.get("nGear", 1)) else 1,
                "x": float(row.get("X", 0)) if pd.notna(row.get("X", 0)) else 0.0,
                "y": float(row.get("Y", 0)) if pd.notna(row.get("Y", 0)) else 0.0
            })

        await cache.set(cache_key, telemetry_data)
        return telemetry_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching telemetry: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def _extract_telemetry_rows(telemetry_df: pd.DataFrame) -> list:
    """Convert a FastF1 telemetry DataFrame into a list of dicts for the API."""
    rows = []
    for _, row in telemetry_df.iterrows():
        time_val = row.get("Time", 0)
        if pd.notna(time_val) and hasattr(time_val, "total_seconds"):
            time_float = time_val.total_seconds()
        elif pd.notna(time_val):
            time_float = float(time_val)
        else:
            time_float = 0.0
        rows.append({
            "time": time_float,
            "speed":    float(row.get("Speed",    0)) if pd.notna(row.get("Speed",    0)) else 0.0,
            "throttle": float(row.get("Throttle", 0)) if pd.notna(row.get("Throttle", 0)) else 0.0,
            "brake":    float(row.get("Brake",    0)) if pd.notna(row.get("Brake",    0)) else 0.0,
            "gear":     int(row.get("nGear",      1)) if pd.notna(row.get("nGear",    1)) else 1,
            "x":        float(row.get("X",        0)) if pd.notna(row.get("X",        0)) else 0.0,
            "y":        float(row.get("Y",        0)) if pd.notna(row.get("Y",        0)) else 0.0,
            "distance": float(row.get("Distance", 0)) if pd.notna(row.get("Distance", 0)) else 0.0,
        })
    return rows


def _lap_row(laps_df, lap_num: int):
    """Return the DataFrame row for a specific lap — robust to float LapNumber."""
    try:
        # Cast to int to handle float64 LapNumber stored by FastF1
        mask = laps_df["LapNumber"].astype(int) == int(lap_num)
        row = laps_df[mask]
        return row if not row.empty else None
    except Exception:
        return None


def _safe_sector_secs(laps_df, lap_num: int, col: str):
    try:
        row = _lap_row(laps_df, lap_num)
        if row is None:
            return None
        val = row.iloc[0][col]
        if pd.isna(val) or not hasattr(val, "total_seconds"):
            return None
        return round(val.total_seconds(), 3)
    except Exception:
        return None


def _laptime_secs(laps_df, lap_num: int):
    """Return lap time in seconds from FastF1 laps DataFrame, or None."""
    try:
        row = _lap_row(laps_df, lap_num)
        if row is None:
            return None
        val = row.iloc[0]["LapTime"]
        if pd.isna(val) or not hasattr(val, "total_seconds"):
            return None
        return val.total_seconds()
    except Exception:
        return None


def _laptime_from_telemetry(tel_rows: list):
    """Compute approximate lap time from telemetry time span."""
    if not tel_rows or len(tel_rows) < 2:
        return None
    times = [p["time"] for p in tel_rows if p.get("time", 0) > 0]
    if len(times) < 2:
        return None
    return max(times) - min(times)


def _fmt_secs(total) -> str:
    if total is None:
        return "N/A"
    mins = int(total // 60)
    secs = total % 60
    return f"{mins}:{secs:06.3f}"


def _fmt_laptime(laps_df, lap_num: int, tel_rows: list = None) -> str:
    """Format lap time — falls back to telemetry time span when FastF1 LapTime is NaT."""
    t = _laptime_secs(laps_df, lap_num)
    if t is None and tel_rows:
        t = _laptime_from_telemetry(tel_rows)
    return _fmt_secs(t)


def _speed_based_sector_delta(tel1: list, tel2: list, frac_start: float, frac_end: float) -> float:
    """
    When FastF1 sector times are unavailable (SC laps, etc.), derive a proxy delta
    by comparing average speeds across a fraction of each driver's telemetry.
    Returns a value with the same sign convention as sector time deltas:
      negative  → driver1 is faster in this section
      positive  → driver2 is faster in this section
    """
    def avg_speed(tel, s, e):
        n = len(tel)
        if n == 0:
            return 0.0
        chunk = tel[int(n * s): int(n * e)]
        speeds = [p["speed"] for p in chunk if p.get("speed", 0) > 0]
        return sum(speeds) / len(speeds) if speeds else 0.0

    sp1 = avg_speed(tel1, frac_start, frac_end)
    sp2 = avg_speed(tel2, frac_start, frac_end)
    # higher speed = faster in time → lower time → should give negative delta for that driver
    return sp2 - sp1  # negative when d1 is faster (sp1 > sp2)


def _sector_boundary_xy(tel_rows: list, cumulative_time: float) -> dict | None:
    """Return the x,y track coordinate closest to a cumulative sector time."""
    if not tel_rows or cumulative_time is None:
        return None
    best = None
    best_diff = float("inf")
    for pt in tel_rows:
        diff = abs(pt["time"] - cumulative_time)
        if diff < best_diff:
            best_diff = diff
            best = {"x": pt["x"], "y": pt["y"]}
    return best


@router.get("/compare/{year}/{round}/{session}/{driver1}/{lap1}/{driver2}/{lap2}")
async def compare_telemetry(
    year: int, round: int, session: str,
    driver1: str, lap1: int,
    driver2: str, lap2: int,
):
    """Compare telemetry between two drivers — loads session ONCE, cached in memory."""
    try:
        from src.routers.drivers import safe_get_team_color

        # ------------------------------------------------------------------
        # 0. Full-response cache (in-process) — instant repeat requests
        # ------------------------------------------------------------------
        cmp_key = f"cmp_{year}_{round}_{session}_{driver1}_{lap1}_{driver2}_{lap2}"
        if cmp_key in _COMPARE_CACHE:
            logger.info(f"Returning cached comparison {cmp_key}")
            return _COMPARE_CACHE[cmp_key]

        # ------------------------------------------------------------------
        # 1. Per-telemetry cache check (Redis or in-process telemetry)
        # ------------------------------------------------------------------
        cache_key_1 = f"{year}_{round}_{session}_{driver1}_{lap1}"
        cache_key_2 = f"{year}_{round}_{session}_{driver2}_{lap2}"
        tel1_cached = await cache.get(cache_key_1)
        tel2_cached = await cache.get(cache_key_2)

        # In-process telemetry cache fallback
        if tel1_cached is None:
            tel1_cached = _COMPARE_CACHE.get(f"tel_{cache_key_1}")
        if tel2_cached is None:
            tel2_cached = _COMPARE_CACHE.get(f"tel_{cache_key_2}")

        # ------------------------------------------------------------------
        # 2. Load session ONCE via in-process cache (telemetry only if needed)
        # ------------------------------------------------------------------
        need_telemetry = (tel1_cached is None) or (tel2_cached is None)
        sk = _session_key(year, round, session)
        session_data = _get_cached_session(sk)
        if session_data is None:
            session_data = fastf1.get_session(year, round, session)
            session_data.load(telemetry=need_telemetry)
            _put_session(sk, session_data)
        elif need_telemetry and not getattr(session_data, '_telemetry_loaded', False):
            session_data.load(telemetry=True)
            session_data._telemetry_loaded = True

        laps = session_data.laps
        d1_laps = laps.pick_drivers([driver1])
        d2_laps = laps.pick_drivers([driver2])

        # ------------------------------------------------------------------
        # 3. Build telemetry rows (from cache or from session)
        # ------------------------------------------------------------------
        if tel1_cached is None:
            d1_lap_df = d1_laps.pick_laps(lap1)
            if d1_lap_df.empty:
                raise HTTPException(404, f"No lap data for {driver1} lap {lap1}")
            tel1 = _extract_telemetry_rows(d1_lap_df.get_telemetry().reset_index(drop=True))
            await cache.set(cache_key_1, tel1)
            _COMPARE_CACHE[f"tel_{cache_key_1}"] = tel1
        else:
            tel1 = tel1_cached

        if tel2_cached is None:
            d2_lap_df = d2_laps.pick_laps(lap2)
            if d2_lap_df.empty:
                raise HTTPException(404, f"No lap data for {driver2} lap {lap2}")
            tel2 = _extract_telemetry_rows(d2_lap_df.get_telemetry().reset_index(drop=True))
            await cache.set(cache_key_2, tel2)
            _COMPARE_CACHE[f"tel_{cache_key_2}"] = tel2
        else:
            tel2 = tel2_cached

        # ------------------------------------------------------------------
        # 4. Sector times & lap times from laps DataFrame
        # ------------------------------------------------------------------
        d1_s1 = _safe_sector_secs(d1_laps, lap1, "Sector1Time")
        d1_s2 = _safe_sector_secs(d1_laps, lap1, "Sector2Time")
        d1_s3 = _safe_sector_secs(d1_laps, lap1, "Sector3Time")
        d2_s1 = _safe_sector_secs(d2_laps, lap2, "Sector1Time")
        d2_s2 = _safe_sector_secs(d2_laps, lap2, "Sector2Time")
        d2_s3 = _safe_sector_secs(d2_laps, lap2, "Sector3Time")

        # ------------------------------------------------------------------
        # 5. Exact sector boundary x,y from driver1's telemetry
        #    (sector 1 ends at d1_s1 seconds, sector 2 ends at d1_s1+d1_s2)
        # ------------------------------------------------------------------
        sector_boundaries = []
        if d1_s1:
            pt = _sector_boundary_xy(tel1, d1_s1)
            if pt:
                sector_boundaries.append({"sector": 1, **pt})
        if d1_s1 and d1_s2:
            pt = _sector_boundary_xy(tel1, d1_s1 + d1_s2)
            if pt:
                sector_boundaries.append({"sector": 2, **pt})

        # ------------------------------------------------------------------
        # 6. Driver info & colours
        # ------------------------------------------------------------------
        driver1_info = session_data.get_driver(driver1)
        driver2_info = session_data.get_driver(driver2)

        driver1_team = driver1_info.get("TeamName", "") if driver1_info is not None and not driver1_info.empty else ""
        driver2_team = driver2_info.get("TeamName", "") if driver2_info is not None and not driver2_info.empty else ""

        driver1_color = safe_get_team_color(driver1_team, session_data)
        driver2_color = safe_get_team_color(driver2_team, session_data)

        # ------------------------------------------------------------------
        # 7. Build response
        # ------------------------------------------------------------------
        def _delta(a, b):
            return _round(a - b, 3) if (a is not None and b is not None) else None

        # Sector time deltas — fall back to speed proxy when times are unavailable
        delta_s1 = _delta(d1_s1, d2_s1)
        delta_s2 = _delta(d1_s2, d2_s2)
        delta_s3 = _delta(d1_s3, d2_s3)

        if delta_s1 is None:
            delta_s1 = _round(_speed_based_sector_delta(tel1, tel2, 0.00, 0.33), 3)
        if delta_s2 is None:
            delta_s2 = _round(_speed_based_sector_delta(tel1, tel2, 0.33, 0.66), 3)
        if delta_s3 is None:
            delta_s3 = _round(_speed_based_sector_delta(tel1, tel2, 0.66, 1.00), 3)

        # Lap times — prefer FastF1, fall back to telemetry time span
        d1_lt = _laptime_secs(d1_laps, lap1) or _laptime_from_telemetry(tel1)
        d2_lt = _laptime_secs(d2_laps, lap2) or _laptime_from_telemetry(tel2)

        # Overall time delta — prefer real lap times, then sector sums, then telemetry
        time_delta = _delta(d1_lt, d2_lt)
        if time_delta is None:
            sector_sum = _delta(
                (d1_s1 or 0) + (d1_s2 or 0) + (d1_s3 or 0),
                (d2_s1 or 0) + (d2_s2 or 0) + (d2_s3 or 0),
            )
            time_delta = sector_sum if sector_sum else _round(delta_s1 + delta_s2 + delta_s3, 3)

        result = {
            "sector_boundaries": sector_boundaries,
            "driver1": {
                "code":    driver1,
                "lap":     lap1,
                "lapTime": _fmt_secs(d1_lt),
                "color":   driver1_color,
                "team":    driver1_team,
                "sectors": {"s1": d1_s1, "s2": d1_s2, "s3": d1_s3},
                "data": {
                    "time":     [d["time"]     for d in tel1],
                    "speed":    [d["speed"]    for d in tel1],
                    "throttle": [d["throttle"] for d in tel1],
                    "brake":    [d["brake"]    for d in tel1],
                    "gear":     [d["gear"]     for d in tel1],
                    "distance": [d["distance"] for d in tel1],
                },
            },
            "driver2": {
                "code":    driver2,
                "lap":     lap2,
                "lapTime": _fmt_secs(d2_lt),
                "color":   driver2_color,
                "team":    driver2_team,
                "sectors": {"s1": d2_s1, "s2": d2_s2, "s3": d2_s3},
                "data": {
                    "time":     [d["time"]     for d in tel2],
                    "speed":    [d["speed"]    for d in tel2],
                    "throttle": [d["throttle"] for d in tel2],
                    "brake":    [d["brake"]    for d in tel2],
                    "gear":     [d["gear"]     for d in tel2],
                    "distance": [d["distance"] for d in tel2],
                },
            },
            "delta": {
                "sector1": delta_s1,
                "sector2": delta_s2,
                "sector3": delta_s3,
                "time":    time_delta,
            },
        }

        # Store in in-process cache for instant repeat requests
        _COMPARE_CACHE[cmp_key] = result
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error comparing telemetry: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/standings/{year}/{round}/{session}/{lap}")
async def get_lap_standings(year: int, round: int, session: str, lap: int):
    """Get driver standings at a specific lap — uses latest completed lap per driver."""
    try:
        sk = _session_key(year, round, session)
        session_data = _get_cached_session(sk)
        if session_data is None:
            logger.info(f"Standings: loading session {year} R{round} {session} from FastF1…")
            session_data = fastf1.get_session(year, round, session)
            session_data.load(telemetry=False)
            _put_session(sk, session_data)
        laps = session_data.laps

        if laps.empty:
            logger.warning("Standings: laps DataFrame is empty")
            return []

        completed = laps[laps["LapNumber"].astype(int) <= int(lap)].copy()
        if completed.empty:
            logger.warning(f"Standings: no laps <= {lap}")
            return []

        latest = (
            completed.sort_values("LapNumber")
            .groupby("Driver", as_index=False)
            .last()
        )

        # Determine column names (FastF1 versions differ)
        cols = set(latest.columns)
        pos_col  = "Position"  if "Position"  in cols else None
        team_col = "Team"      if "Team"      in cols else ("TeamName" if "TeamName" in cols else None)
        lt_col   = "LapTime"   if "LapTime"   in cols else None

        standings = []
        for idx, row in latest.iterrows():
            try:
                pos_val = row[pos_col] if pos_col else None
                position = int(pos_val) if pos_val is not None and pd.notna(pos_val) else 99
            except (ValueError, TypeError):
                position = 99

            lap_time_str = "—"
            try:
                if lt_col:
                    lt = row[lt_col]
                    if pd.notna(lt) and hasattr(lt, "total_seconds"):
                        total = lt.total_seconds()
                        mins = int(total // 60)
                        secs = total % 60
                        lap_time_str = f"{mins}:{secs:06.3f}"
            except Exception:
                pass

            team_name = ""
            if team_col:
                try:
                    team_name = str(row[team_col]) if pd.notna(row[team_col]) else ""
                except Exception:
                    pass

            standings.append({
                "position": position,
                "driver":   str(row.get("Driver", "UNK")),
                "team":     team_name,
                "lap_time": lap_time_str,
            })

        standings.sort(key=lambda x: x["position"])
        logger.info(f"Standings for lap {lap}: {len(standings)} drivers")
        return standings

    except Exception as e:
        logger.error(f"Error getting lap standings: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/track/{year}/{round}")
async def get_track_data(year: int, round: int):
    """Get track layout data for visualization"""
    try:
        # Try Supabase RPC first
        result = supabase.rpc(
            "rpc_get_track_layout",
            {"p_year": year, "p_round": round}
        ).execute()

        if result.data:
            logger.info(f"Supabase returned track layout for {year} R{round}")
            return result.data

        # Fallback to FastF1
        logger.info(f"Supabase returned no track data, falling back to FastF1")
        session_data = fastf1.get_session(year, round, "Race")
        session_data.load()

        laps = session_data.laps
        if laps.empty:
            raise HTTPException(status_code=404, detail="No lap data found for track")

        first_lap = laps.iloc[0]
        telemetry = first_lap.get_telemetry()

        circuit_info = session_data.event
        circuit_name = circuit_info.get('EventName', 'Unknown Circuit')

        track_data = {
            "circuit_name": circuit_name,
            "coordinates": {
                "x": [float(x) if pd.notna(x) else 0.0 for x in telemetry["X"]],
                "y": [float(y) if pd.notna(y) else 0.0 for y in telemetry["Y"]],
                "distance": [float(d) if pd.notna(d) else 0.0 for d in telemetry["Distance"]]
            },
            "sector_boundaries": []
        }

        return track_data

    except Exception as e:
        logger.error(f"Error fetching track data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
