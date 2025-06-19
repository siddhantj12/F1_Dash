import fastf1
import pandas as pd
from datetime import datetime
import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from supabase_client import supabase

def fetch_and_store_lap_times(year, round_number):
    """
    Fetch lap times for a given race and store them in Supabase
    """
    # Enable cache
    fastf1.Cache.enable_cache('cache')
    
    # Load the session
    session = fastf1.get_session(year, round_number, 'R')
    session.load()
    
    # Get lap times
    laps_df = session.laps
    
    # Prepare data for Supabase
    lap_times_data = []
    for _, lap in laps_df.iterrows():
        lap_time_data = {
            'year': year,
            'round': round_number,
            'driver_number': str(lap['DriverNumber']),  # Convert to string
            'lap_number': int(lap['LapNumber']),  # Convert to integer
            'lap_time': lap['LapTime'].total_seconds() if pd.notna(lap['LapTime']) else None,
            'sector1_time': lap['Sector1Time'].total_seconds() if pd.notna(lap['Sector1Time']) else None,
            'sector2_time': lap['Sector2Time'].total_seconds() if pd.notna(lap['Sector2Time']) else None,
            'sector3_time': lap['Sector3Time'].total_seconds() if pd.notna(lap['Sector3Time']) else None,
            'compound': str(lap['Compound']) if pd.notna(lap['Compound']) else None,
            'tyre_life': int(lap['TyreLife']) if pd.notna(lap['TyreLife']) else None,
            'track_status': str(lap['TrackStatus']) if pd.notna(lap['TrackStatus']) else None
        }
        lap_times_data.append(lap_time_data)
    
    # Store in Supabase
    for lap_time in lap_times_data:
        try:
            # Upsert the lap time data
            result = supabase.table('lap_times').upsert(lap_time).execute()
            print(f"Stored lap time: {lap_time['year']} Round {lap_time['round']} Lap {lap_time['lap_number']} Driver {lap_time['driver_number']}")
        except Exception as e:
            print(f"Error storing lap time: {str(e)}")

def fetch_all_lap_times(year):
    """
    Fetch lap times for all races in a given year
    """
    # Enable cache
    fastf1.Cache.enable_cache('cache')
    
    # Load the season
    season = fastf1.get_event_schedule(year)
    
    # Fetch lap times for each race
    for _, race in season.iterrows():
        # Skip pre-season tests
        if 'Test' in race['EventName']:
            continue
        print(f"\nFetching lap times for {race['EventName']} ({year} Round {race['RoundNumber']})...")
        fetch_and_store_lap_times(year, race['RoundNumber'])

if __name__ == "__main__":
    # Fetch lap times for the last few years
    current_year = datetime.now().year
    for year in range(current_year - 5, current_year + 1):
        print(f"\nFetching lap times for {year}...")
        fetch_all_lap_times(year) 