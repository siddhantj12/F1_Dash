"""
Incremental script to populate one table for one year.

Usage:
    python scripts/populate_year.py --year 2022 --table track_layouts
    python scripts/populate_year.py --year 2020 --table weather
    python scripts/populate_year.py --year 2023 --table laps
"""
import argparse
import sys
sys.path.insert(0, '.')

import fastf1
import pandas as pd
from supabase_setup import supabase

fastf1.Cache.enable_cache('fastf1_cache')

# ============================================================================
# TRACK LAYOUTS
# ============================================================================
def populate_track_layouts(year):
    print(f"Populating track_layouts for {year}...")
    
    schedule = fastf1.get_event_schedule(year)
    races = schedule[schedule['RoundNumber'] > 0]
    
    inserted = 0
    for _, race in races.iterrows():
        round_num = race['RoundNumber']
        event_name = race['EventName']
        
        # Check if exists
        res = supabase.table('track_layouts').select('id').eq('year', year).eq('round', round_num).limit(1).execute()
        if res.data:
            print(f"  R{round_num} {event_name} - exists, skipping")
            continue
        
        try:
            session = fastf1.get_session(year, round_num, 'Race')
            session.load(laps=True, telemetry=True, weather=False)
            
            laps_df = session.laps
            if laps_df.empty:
                print(f"  R{round_num} {event_name} - no laps")
                continue
            
            first_lap = laps_df.iloc[0]
            tel = first_lap.get_telemetry()
            
            if tel is None or tel.empty:
                print(f"  R{round_num} {event_name} - no telemetry")
                continue
            
            circuit_name = session.event.get('EventName', 'Unknown')
            
            x_coords = [float(x) if pd.notna(x) else 0.0 for x in tel['X']][::5]
            y_coords = [float(y) if pd.notna(y) else 0.0 for y in tel['Y']][::5]
            distances = [float(d) if pd.notna(d) else 0.0 for d in tel['Distance']][::5]
            
            track_data = {
                'year': year,
                'round': round_num,
                'circuit_name': circuit_name,
                'x_coords': x_coords,
                'y_coords': y_coords,
                'distances': distances
            }
            
            supabase.table('track_layouts').insert(track_data).execute()
            inserted += 1
            print(f"  R{round_num} {event_name} - inserted")
            
        except Exception as e:
            print(f"  R{round_num} {event_name} - error: {e}")
    
    print(f"\nTotal inserted: {inserted}")
    return inserted

# ============================================================================
# WEATHER
# ============================================================================
def populate_weather(year):
    print(f"Populating weather for {year}...")
    
    schedule = fastf1.get_event_schedule(year)
    races = schedule[schedule['RoundNumber'] > 0]
    session_types = ['Practice 1', 'Practice 2', 'Practice 3', 'Qualifying', 'Race']
    
    inserted = 0
    for _, race in races.iterrows():
        round_num = race['RoundNumber']
        event_name = race['EventName']
        print(f"\n  {event_name} (R{round_num})")
        
        # Get race_id
        res = supabase.table('races').select('id').eq('year', year).eq('round', round_num).limit(1).execute()
        if not res.data:
            continue
        race_id = res.data[0]['id']
        
        for session_type in session_types:
            # Get session_id
            res = supabase.table('sessions').select('id').eq('race_id', race_id).eq('type', session_type).limit(1).execute()
            if res.data:
                session_id = res.data[0]['id']
            else:
                # Create session if it doesn't exist (will load session below)
                session_id = None
            
            # Check if weather exists for this session
            if session_id:
                res = supabase.table('weather').select('id').eq('session_id', session_id).limit(1).execute()
                if res.data:
                    continue
            
            try:
                session = fastf1.get_session(year, round_num, session_type)
                session.load(laps=False, telemetry=False, weather=True)
                
                # Create session if it doesn't exist
                if not session_id:
                    res = supabase.table('sessions').insert({
                        'race_id': race_id,
                        'type': session_type,
                        'session_type': session_type,
                        'date': session.date.isoformat() if session.date else None
                    }).execute()
                    session_id = res.data[0]['id'] if res.data else None
                    if not session_id:
                        continue
                
                weather_df = session.weather_data
                if weather_df is None or weather_df.empty:
                    continue
                
                # Store first weather reading (or average)
                row = weather_df.iloc[0]
                
                weather_data = {
                    'session_id': session_id,
                    'timestamp': weather_df.index[0].isoformat() if hasattr(weather_df.index[0], 'isoformat') else None,
                    'air_temperature': float(row.get('AirTemp')) if pd.notna(row.get('AirTemp')) else None,
                    'track_temperature': float(row.get('TrackTemp')) if pd.notna(row.get('TrackTemp')) else None,
                    'humidity': float(row.get('Humidity')) if pd.notna(row.get('Humidity')) else None,
                    'pressure': float(row.get('Pressure')) if pd.notna(row.get('Pressure')) else None,
                    'wind_speed': float(row.get('WindSpeed')) if pd.notna(row.get('WindSpeed')) else None,
                    'wind_direction': float(row.get('WindDirection')) if pd.notna(row.get('WindDirection')) else None,
                    'rainfall': float(row.get('Rainfall')) if pd.notna(row.get('Rainfall')) else None
                }
                
                supabase.table('weather').insert(weather_data).execute()
                inserted += 1
                print(f"    {session_type} - done")
                
            except Exception as e:
                pass  # Session might not exist (e.g., no Sprint)
    
    print(f"\nTotal inserted: {inserted}")
    return inserted

# ============================================================================
# LAPS
# ============================================================================
def populate_laps(year):
    print(f"Populating laps for {year}...")
    
    schedule = fastf1.get_event_schedule(year)
    races = schedule[schedule['RoundNumber'] > 0]
    session_types = ['Practice 1', 'Practice 2', 'Practice 3', 'Qualifying', 'Race']
    
    total_inserted = 0
    
    for _, race in races.iterrows():
        round_num = race['RoundNumber']
        event_name = race['EventName']
        print(f"\n  {event_name} (R{round_num})")
        
        # Get race_id
        res = supabase.table('races').select('id').eq('year', year).eq('round', round_num).limit(1).execute()
        if not res.data:
            print(f"    Race not in DB, skipping")
            continue
        race_id = res.data[0]['id']
        
        for session_type in session_types:
            # Get or create session
            res = supabase.table('sessions').select('id').eq('race_id', race_id).eq('type', session_type).limit(1).execute()
            if res.data:
                session_id = res.data[0]['id']
            else:
                res = supabase.table('sessions').insert({'race_id': race_id, 'type': session_type, 'session_type': session_type}).execute()
                session_id = res.data[0]['id'] if res.data else None
            
            if not session_id:
                continue
            
            # Check if laps exist for this session
            res = supabase.table('laps').select('id', count='exact').eq('session_id', session_id).limit(1).execute()
            if (res.count or 0) > 10:  # Already has laps
                continue
            
            try:
                session = fastf1.get_session(year, round_num, session_type)
                session.load(laps=True, telemetry=False, weather=False)
                
                laps_df = session.laps
                if laps_df.empty:
                    continue
                
                batch = []
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
                    
                    if len(batch) >= 500:
                        supabase.table('laps').insert(batch).execute()
                        total_inserted += len(batch)
                        batch = []
                
                if batch:
                    supabase.table('laps').insert(batch).execute()
                    total_inserted += len(batch)
                
                print(f"    {session_type} - done")
                
            except Exception as e:
                pass
    
    print(f"\nTotal inserted: {total_inserted}")
    return total_inserted

# ============================================================================
# MAIN
# ============================================================================
def main():
    parser = argparse.ArgumentParser(description='Populate Supabase table for a specific year')
    parser.add_argument('--year', type=int, required=True, help='Year to populate')
    parser.add_argument('--table', type=str, required=True, choices=['track_layouts', 'weather', 'laps'], help='Table to populate')
    args = parser.parse_args()
    
    if args.table == 'track_layouts':
        populate_track_layouts(args.year)
    elif args.table == 'weather':
        populate_weather(args.year)
    elif args.table == 'laps':
        populate_laps(args.year)

if __name__ == '__main__':
    main()

