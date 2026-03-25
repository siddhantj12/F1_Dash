"""
Unified ETL script to populate Supabase with FastF1 data.

Usage:
    python scripts/populate_all.py                    # Full run (2020-2025)
    python scripts/populate_all.py --year 2024       # Single year
    python scripts/populate_all.py --year 2024 --round 1  # Single race
    python scripts/populate_all.py --skip-telemetry  # Skip telemetry (large)
    python scripts/populate_all.py --year 2023 --round 1 --telemetry-sample-rate 10  # Race telemetry only (default rate)

Features:
    - Incremental: skips already-populated data
    - Batch inserts for efficiency
    - Progress tracking
    - Handles all tables: drivers, laps, telemetry, track_layouts, weather
"""

import argparse
import sys
import os

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import fastf1
import pandas as pd
from datetime import datetime
from supabase_setup import supabase

# Configuration
YEARS = range(2020, 2026)
SESSION_TYPES = ['Practice 1', 'Practice 2', 'Practice 3', 'Qualifying', 'Race']
BATCH_SIZE = 500
CACHE_DIR = 'fastf1_cache'

# Enable FastF1 cache
fastf1.Cache.enable_cache(CACHE_DIR)


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


# ============================================================================
# DRIVERS
# ============================================================================
def get_existing_drivers(year):
    """Get driver codes already in Supabase for a year."""
    res = supabase.table('drivers').select('driver_code').eq('year', year).execute()
    return {d['driver_code'] for d in res.data} if res.data else set()


def populate_drivers(year):
    """Populate drivers table for a season."""
    log(f"Populating drivers for {year}...")
    existing = get_existing_drivers(year)
    
    try:
        # Get first actual race of the season (skip testing events)
        schedule = fastf1.get_event_schedule(year)
        if schedule.empty:
            log(f"  No events found for {year}")
            return
        
        # Find first race with RoundNumber > 0 (skip pre-season testing)
        races = schedule[schedule['RoundNumber'] > 0]
        if races.empty:
            log(f"  No races found for {year}")
            return
        
        first_round = races.iloc[0]['RoundNumber']
        session = fastf1.get_session(year, first_round, 'Race')
        session.load(laps=False, telemetry=False, weather=False)
        
        if not hasattr(session, 'results') or session.results.empty:
            log(f"  No results data for {year}")
            return
        
        batch = []
        for _, row in session.results.iterrows():
            code = row.get('Abbreviation', '')
            if not code or code in existing:
                continue
            
            batch.append({
                'year': year,
                'driver_number': str(row.get('DriverNumber', '')),
                'driver_code': code,
                'first_name': row.get('FirstName', ''),
                'last_name': row.get('LastName', ''),
                'team_name': row.get('TeamName', ''),
                'country_code': row.get('CountryCode', '') or ''
            })
        
        if batch:
            supabase.table('drivers').insert(batch).execute()
            log(f"  Inserted {len(batch)} drivers")
        else:
            log(f"  All drivers already exist")
            
    except Exception as e:
        log(f"  Error: {e}")


# ============================================================================
# RACES & SESSIONS (ensure they exist)
# ============================================================================
def get_or_create_race(year, round_num, event):
    """Get race_id, create if doesn't exist."""
    res = supabase.table('races').select('id').eq('year', year).eq('round', round_num).limit(1).execute()
    if res.data:
        return res.data[0]['id']
    
    # Create race
    race_data = {
        'year': year,
        'round': round_num,
        'race_name': event.get('EventName', ''),
        'circuit_name': event.get('Location', ''),
        'country': event.get('Country', ''),
        'date': event.get('EventDate').strftime('%Y-%m-%d') if event.get('EventDate') else None
    }
    res = supabase.table('races').insert(race_data).execute()
    return res.data[0]['id'] if res.data else None


def get_or_create_session(race_id, session_type):
    """Get session_id, create if doesn't exist."""
    res = supabase.table('sessions').select('id').eq('race_id', race_id).eq('type', session_type).limit(1).execute()
    if res.data:
        return res.data[0]['id']
    
    # Create session
    session_data = {
        'race_id': race_id,
        'type': session_type,
        'session_type': session_type
    }
    res = supabase.table('sessions').insert(session_data).execute()
    return res.data[0]['id'] if res.data else None


# ============================================================================
# LAPS
# ============================================================================
def get_existing_laps_count(session_id):
    """Get count of laps already in Supabase for a session."""
    res = supabase.table('laps').select('id', count='exact').eq('session_id', session_id).limit(1).execute()
    return res.count or 0


def populate_laps(session_id, fastf1_session):
    """Populate laps table for a session."""
    existing_count = get_existing_laps_count(session_id)
    
    laps_df = fastf1_session.laps
    if laps_df.empty:
        return 0
    
    # Skip if already populated (rough check)
    if existing_count >= len(laps_df) * 0.9:
        return 0
    
    batch = []
    inserted = 0
    
    for _, lap in laps_df.iterrows():
        lap_time = lap.get('LapTime')
        sector1 = lap.get('Sector1Time')
        sector2 = lap.get('Sector2Time')
        sector3 = lap.get('Sector3Time')
        
        batch.append({
            'session_id': session_id,
            'driver_code': lap.get('Driver', ''),
            'lap_number': int(lap.get('LapNumber', 0)),
            'lap_time': str(lap_time) if pd.notna(lap_time) else None,
            'sector1': str(sector1) if pd.notna(sector1) else None,
            'sector2': str(sector2) if pd.notna(sector2) else None,
            'sector3': str(sector3) if pd.notna(sector3) else None,
            'compound': lap.get('Compound', None)
        })
        
        if len(batch) >= BATCH_SIZE:
            try:
                supabase.table('laps').insert(batch).execute()
                inserted += len(batch)
            except Exception as e:
                log(f"    Batch insert error: {e}")
            batch = []
    
    if batch:
        try:
            supabase.table('laps').insert(batch).execute()
            inserted += len(batch)
        except Exception as e:
            log(f"    Final batch error: {e}")
    
    return inserted


# ============================================================================
# TELEMETRY
# ============================================================================
def get_existing_telemetry_count(lap_id):
    """Check if telemetry exists for a lap (cheap existence check)."""
    # Avoid count='exact' here; it can be slow and trigger statement timeouts.
    res = supabase.table('telemetry').select('id').eq('lap_id', lap_id).limit(1).execute()
    return 1 if res.data else 0


def _is_transient_supabase_error(err: Exception) -> bool:
    msg = str(err)
    # Common transient cases we have seen during backfills:
    # - Cloudflare/Supabase 502 (HTML instead of JSON)
    # - Postgres statement timeout (57014)
    return (" 502" in msg) or ("Bad gateway" in msg) or ("57014" in msg) or ("statement timeout" in msg)


def _retry(fn, *, tries=5, base_sleep_s=0.75):
    """Retry helper for transient Supabase errors (best-effort)."""
    import time

    last_err = None
    for attempt in range(tries):
        try:
            return fn()
        except Exception as e:
            last_err = e
            if (attempt == tries - 1) or (not _is_transient_supabase_error(e)):
                raise
            time.sleep(base_sleep_s * (2 ** attempt))
    raise last_err


def get_lap_id(session_id, driver_code, lap_number):
    """Get lap_id from Supabase."""
    res = supabase.table('laps').select('id').eq('session_id', session_id).eq('driver_code', driver_code).eq('lap_number', lap_number).limit(1).execute()
    if not res.data:
        # log(f"      Lap not found: SID={session_id}, Drv={driver_code}, L#{lap_number}")
        return None
    return res.data[0]['id']


def _lap_time_seconds(row_time):
    """Match semantics used in src/routers/telemetry.py (seconds into lap)."""
    if row_time is None or not pd.notna(row_time):
        return 0.0
    if hasattr(row_time, 'total_seconds'):
        return float(row_time.total_seconds())
    try:
        return float(row_time)
    except (TypeError, ValueError):
        return 0.0


def _brake_as_float(val):
    if val is None or not pd.notna(val):
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return 1.0 if bool(val) else 0.0


def _optional_float(val):
    return float(val) if val is not None and pd.notna(val) else None


def _optional_int(val):
    return int(val) if val is not None and pd.notna(val) else None


def populate_telemetry(session_id, fastf1_session, sample_rate=10):
    """
    Populate telemetry table for a session (full merged channel: XY + speed, etc.).
    sample_rate: keep every Nth row from FastF1 merged telemetry (~20Hz source).
    Skips laps that already have any telemetry rows (idempotent re-runs).
    """
    laps_df = fastf1_session.laps
    if laps_df.empty:
        log("      No laps found in FastF1 session")
        return 0
    
    log(f"      Processing telemetry for {len(laps_df)} laps (1/{sample_rate} samples)...")
    inserted = 0
    error_logged = 0
    
    for _, lap in laps_df.iterrows():
        driver_code = lap.get('Driver', '')
        lap_number = int(lap.get('LapNumber', 0))
        
        lap_id = get_lap_id(session_id, driver_code, lap_number)
        if not lap_id:
            continue
        
        try:
            # Skip if already has telemetry (keep this inside try so timeouts don't abort the session)
            if _retry(lambda: get_existing_telemetry_count(lap_id), tries=4) > 0:
                continue

            tel = lap.get_telemetry()
            if tel is None or tel.empty:
                continue
            
            tel = tel.reset_index(drop=True)
            tel_sampled = tel.iloc[::sample_rate]
            
            batch = []
            for _, row in tel_sampled.iterrows():
                time_sec = _lap_time_seconds(row.get('Time'))
                brake_val = _brake_as_float(row.get('Brake'))
                ngear = row.get('nGear')
                gear_val = _optional_int(ngear)
                
                batch.append({
                    'lap_id': lap_id,
                    'timestamp': time_sec,
                    'speed': _optional_float(row.get('Speed')),
                    'throttle': _optional_float(row.get('Throttle')),
                    'brake': brake_val,
                    'gear': gear_val,
                    'rpm': _optional_float(row.get('RPM')),
                    'drs': _optional_int(row.get('DRS')),
                    'distance': _optional_float(row.get('Distance')),
                    'x': _optional_float(row.get('X')),
                    'y': _optional_float(row.get('Y')),
                    'z': _optional_float(row.get('Z')),
                })
            
            if batch:
                _retry(lambda: supabase.table('telemetry').insert(batch).execute(), tries=6)
                inserted += len(batch)
                if inserted % 5000 == 0:
                    log(f"      Progress: {inserted} telemetry points...")
                
        except Exception as e:
            error_logged += 1
            if error_logged <= 5:
                log(f"      Telemetry error lap {lap_number} ({driver_code}): {e}")
    
    if error_logged > 5:
        log(f"      ... {error_logged - 5} more telemetry lap errors (not shown)")
    
    return inserted


# ============================================================================
# TRACK LAYOUTS
# ============================================================================
def get_existing_track_layout(year, round_num):
    """Check if track layout exists."""
    res = supabase.table('track_layouts').select('id').eq('year', year).eq('round', round_num).limit(1).execute()
    return res.data[0]['id'] if res.data else None


def populate_track_layout(year, round_num, fastf1_session):
    """Populate track_layouts table for a race."""
    if get_existing_track_layout(year, round_num):
        return False
    
    laps_df = fastf1_session.laps
    if laps_df.empty:
        return False
    
    try:
        # Get telemetry from first valid lap
        first_lap = laps_df.iloc[0]
        tel = first_lap.get_telemetry()
        
        if tel is None or tel.empty:
            return False
        
        circuit_name = fastf1_session.event.get('EventName', 'Unknown')
        
        # Extract coordinates
        x_coords = [float(x) if pd.notna(x) else 0.0 for x in tel['X']]
        y_coords = [float(y) if pd.notna(y) else 0.0 for y in tel['Y']]
        distances = [float(d) if pd.notna(d) else 0.0 for d in tel['Distance']]
        
        # Sample to reduce size (every 5th point)
        x_coords = x_coords[::5]
        y_coords = y_coords[::5]
        distances = distances[::5]
        
        track_data = {
            'year': year,
            'round': round_num,
            'circuit_name': circuit_name,
            'x_coords': x_coords,
            'y_coords': y_coords,
            'distances': distances
        }
        
        supabase.table('track_layouts').insert(track_data).execute()
        return True
        
    except Exception as e:
        return False


# ============================================================================
# WEATHER
# ============================================================================
def get_existing_weather(session_id):
    """Check if weather exists for session."""
    res = supabase.table('weather').select('id', count='exact').eq('session_id', session_id).limit(1).execute()
    return (res.count or 0) > 0


def populate_weather(session_id, fastf1_session, year, round_num):
    """Populate weather table for a session."""
    if get_existing_weather(session_id):
        return 0

    try:
        weather_df = fastf1_session.weather_data
        if weather_df is None or weather_df.empty:
            return 0

        # Just store one weather snapshot per session (first reading)
        row = weather_df.iloc[0]

        weather_data = {
            'session_id': session_id,
            'air_temperature': float(row.get('AirTemp')) if pd.notna(row.get('AirTemp')) else None,
            'track_temperature': float(row.get('TrackTemp')) if pd.notna(row.get('TrackTemp')) else None,
            'humidity': float(row.get('Humidity')) if pd.notna(row.get('Humidity')) else None,
            'pressure': float(row.get('Pressure')) if pd.notna(row.get('Pressure')) else None,
            'wind_speed': float(row.get('WindSpeed')) if pd.notna(row.get('WindSpeed')) else None,
            'wind_direction': float(row.get('WindDirection')) if pd.notna(row.get('WindDirection')) else None,
            'rainfall': 1 if row.get('Rainfall') else 0
        }

        supabase.table('weather').insert(weather_data).execute()
        return 1

    except Exception as e:
        return 0

# ============================================================================
# MAIN ORCHESTRATION
# ============================================================================
def populate_session(year, round_num, session_type, race_id, include_telemetry=True, telemetry_sample_rate=10):
    """Populate all data for a single session."""
    session_id = get_or_create_session(race_id, session_type)
    if not session_id:
        return
    
    try:
        fastf1_session = fastf1.get_session(year, round_num, session_type)
        fastf1_session.load(
            laps=True,
            telemetry=include_telemetry,
            weather=True
        )
        
        # Laps
        laps_inserted = populate_laps(session_id, fastf1_session)
        if laps_inserted:
            log(f"      Inserted {laps_inserted} laps")
        
        # Weather
        weather_inserted = populate_weather(session_id, fastf1_session, year, round_num)
        if weather_inserted:
            log(f"      Inserted weather data")
        
        # Telemetry (only for Race to limit volume)
        if include_telemetry and session_type == 'Race':
            tel_inserted = populate_telemetry(session_id, fastf1_session, sample_rate=telemetry_sample_rate)
            if tel_inserted:
                log(f"      Inserted {tel_inserted} telemetry points")
        
    except Exception as e:
        log(f"      Session error: {e}")


def populate_race(year, round_num, event, include_telemetry=True, telemetry_sample_rate=10):
    """Populate all data for a single race weekend."""
    race_id = get_or_create_race(year, round_num, event)
    if not race_id:
        log(f"  Could not create race {year} R{round_num}")
        return
    
    log(f"  {event.get('EventName', 'Unknown')} (R{round_num})")
    
    # Track layout (only need once per race)
    try:
        fastf1_session = fastf1.get_session(year, round_num, 'Race')
        fastf1_session.load(laps=True, telemetry=True, weather=False)
        if populate_track_layout(year, round_num, fastf1_session):
            log(f"    Inserted track layout")
    except:
        pass
    
    # Sessions
    for session_type in SESSION_TYPES:
        log(f"    {session_type}...")
        populate_session(
            year, round_num, session_type, race_id, include_telemetry, telemetry_sample_rate
        )


def populate_year(year, specific_round=None, include_telemetry=True, telemetry_sample_rate=10):
    """Populate all data for a season."""
    log(f"\n{'='*60}")
    log(f"YEAR {year}")
    log(f"{'='*60}")
    
    # Drivers first
    populate_drivers(year)
    
    # Get schedule
    try:
        schedule = fastf1.get_event_schedule(year)
    except Exception as e:
        log(f"Could not get schedule for {year}: {e}")
        return
    
    for _, event in schedule.iterrows():
        round_num = event.get('RoundNumber', 0)
        if round_num == 0:
            continue
        
        if specific_round and round_num != specific_round:
            continue
        
        populate_race(year, round_num, event, include_telemetry, telemetry_sample_rate)


def main():
    parser = argparse.ArgumentParser(description='Populate Supabase with FastF1 data')
    parser.add_argument('--year', type=int, help='Specific year to populate')
    parser.add_argument('--round', type=int, help='Specific round to populate')
    parser.add_argument('--skip-telemetry', action='store_true', help='Skip telemetry data')
    parser.add_argument(
        '--telemetry-sample-rate',
        type=int,
        default=10,
        metavar='N',
        help='For Race telemetry: insert every Nth FastF1 sample (default 10 ≈ 2 Hz from ~20 Hz)',
    )
    args = parser.parse_args()
    
    include_telemetry = not args.skip_telemetry
    if args.telemetry_sample_rate < 1:
        raise SystemExit('--telemetry-sample-rate must be >= 1')
    
    log("Starting Supabase population...")
    log(f"Telemetry: {'enabled' if include_telemetry else 'disabled'}")
    if include_telemetry:
        log(f"Telemetry sample rate: 1/{args.telemetry_sample_rate}")
    
    if args.year:
        populate_year(args.year, args.round, include_telemetry, args.telemetry_sample_rate)
    else:
        for year in YEARS:
            populate_year(year, None, include_telemetry, args.telemetry_sample_rate)
    
    log("\nDone!")


if __name__ == "__main__":
    main()

