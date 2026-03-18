"""Populate track layouts for missing years."""
import sys
sys.path.insert(0, '.')

import fastf1
import pandas as pd
from supabase_setup import supabase

fastf1.Cache.enable_cache('fastf1_cache')

def get_existing_track_layout(year, round_num):
    res = supabase.table('track_layouts').select('id').eq('year', year).eq('round', round_num).limit(1).execute()
    return res.data[0]['id'] if res.data else None

def populate_track_layout(year, round_num, event_name):
    if get_existing_track_layout(year, round_num):
        return False
    
    try:
        session = fastf1.get_session(year, round_num, 'Race')
        session.load(laps=True, telemetry=True, weather=False)
        
        laps_df = session.laps
        if laps_df.empty:
            return False
        
        first_lap = laps_df.iloc[0]
        tel = first_lap.get_telemetry()
        
        if tel is None or tel.empty:
            return False
        
        circuit_name = session.event.get('EventName', 'Unknown')
        
        x_coords = [float(x) if pd.notna(x) else 0.0 for x in tel['X']]
        y_coords = [float(y) if pd.notna(y) else 0.0 for y in tel['Y']]
        distances = [float(d) if pd.notna(d) else 0.0 for d in tel['Distance']]
        
        # Sample every 5th point
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
        print(f'    Error: {e}')
        return False

if __name__ == '__main__':
    for year in [2021, 2022, 2023, 2024, 2025]:
        print(f'{year}:')
        try:
            schedule = fastf1.get_event_schedule(year)
            races = schedule[schedule['RoundNumber'] > 0]
            count = 0
            for _, race in races.iterrows():
                round_num = race['RoundNumber']
                event_name = race['EventName']
                if populate_track_layout(year, round_num, event_name):
                    count += 1
                    print(f'  R{round_num} {event_name} - inserted')
            print(f'  Total: {count} track layouts added')
        except Exception as e:
            print(f'  Error getting schedule: {e}')




