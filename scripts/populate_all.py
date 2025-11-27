"""
Unified ETL script to populate Supabase with FastF1 data.

Usage:
    python scripts/populate_all.py                    # Full run (2020-2025)
    python scripts/populate_all.py --year 2024       # Single year
    python scripts/populate_all.py --year 2024 --round 1  # Single race
    python scripts/populate_all.py --skip-telemetry  # Skip telemetry (large)

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
    """Check if telemetry exists for a lap."""
    res = supabase.table('telemetry').select('id', count='exact').eq('lap_id', lap_id).limit(1).execute()
    return res.count or 0


def get_lap_id(session_id, driver_code, lap_number):
    """Get lap_id from Supabase."""
    res = supabase.table('laps').select('id').eq('session_id', session_id).eq('driver_code', driver_code).eq('lap_number', lap_number).limit(1).execute()
    return res.data[0]['id'] if res.data else None


def populate_telemetry(session_id, fastf1_session, sample_rate=10):
    """
    Populate telemetry table for a session.
    sample_rate: only store every Nth point to reduce data volume.
    """
    laps_df = fastf1_session.laps
    if laps_df.empty:
        return 0
    
    inserted = 0
    
    for _, lap in laps_df.iterrows():
        driver_code = lap.get('Driver', '')
        lap_number = int(lap.get('LapNumber', 0))
        
        lap_id = get_lap_id(session_id, driver_code, lap_number)
        if not lap_id:
            continue
        
        # Skip if already has telemetry
        if get_existing_telemetry_count(lap_id) > 0:
            continue
        
        try:
            tel = lap.get_car_data()
            if tel is None or tel.empty:
                continue
            
            # Sample telemetry to reduce volume
            tel_sampled = tel.iloc[::sample_rate]
            
            batch = []
            for _, row in tel_sampled.iterrows():
                time_val = row.get('Time')
                if pd.notna(time_val) and hasattr(time_val, 'total_seconds'):
                    time_sec = time_val.total_seconds()
                else:
                    time_sec = None
                
                batch.append({
                    'lap_id': lap_id,
                    'timestamp': time_sec,
                    'speed': float(row.get('Speed', 0)) if pd.notna(row.get('Speed')) else None,
                    'throttle': float(row.get('Throttle', 0)) if pd.notna(row.get('Throttle')) else None,
                    'brake': float(row.get('Brake', 0)) if pd.notna(row.get('Brake')) else None,
                    'gear': int(row.get('nGear', 0)) if pd.notna(row.get('nGear')) else None
                })
            
            if batch:
                supabase.table('telemetry').insert(batch).execute()
                inserted += len(batch)
                
        except Exception as e:
            # Telemetry often fails for certain laps
            pass
    
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
def get_existing_weather(year, round_num, session_name):
    """Check if weather exists for session."""
    res = supabase.table('weather').select('id', count='exact').eq('year', year).eq('round', round_num).eq('session', session_name).limit(1).execute()
    return (res.count or 0) > 0


def populate_weather(session_id, fastf1_session, year, round_num):
    """Populate weather table for a session."""
    session_name = fastf1_session.name
    if get_existing_weather(year, round_num, session_name):
        return 0
    
    try:
        weather_df = fastf1_session.weather_data
        if weather_df is None or weather_df.empty:
            return 0
        
        # Just store one weather snapshot per session (first reading)
        row = weather_df.iloc[0]
        
        weather_data = {
            'year': year,
            'round': round_num,
            'session': fastf1_session.name,
            'event_name': fastf1_session.event.get('EventName', ''),
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
def populate_session(year, round_num, session_type, race_id, include_telemetry=True):
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
            tel_inserted = populate_telemetry(session_id, fastf1_session)
            if tel_inserted:
                log(f"      Inserted {tel_inserted} telemetry points")
        
    except Exception as e:
        log(f"      Session error: {e}")


def populate_race(year, round_num, event, include_telemetry=True):
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
        populate_session(year, round_num, session_type, race_id, include_telemetry)


def populate_year(year, specific_round=None, include_telemetry=True):
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
        
        populate_race(year, round_num, event, include_telemetry)


def main():
    parser = argparse.ArgumentParser(description='Populate Supabase with FastF1 data')
    parser.add_argument('--year', type=int, help='Specific year to populate')
    parser.add_argument('--round', type=int, help='Specific round to populate')
    parser.add_argument('--skip-telemetry', action='store_true', help='Skip telemetry data')
    args = parser.parse_args()
    
    include_telemetry = not args.skip_telemetry
    
    log("Starting Supabase population...")
    log(f"Telemetry: {'enabled' if include_telemetry else 'disabled'}")
    
    if args.year:
        populate_year(args.year, args.round, include_telemetry)
    else:
        for year in YEARS:
            populate_year(year, None, include_telemetry)
    
    log("\nDone!")


if __name__ == "__main__":
    main()

