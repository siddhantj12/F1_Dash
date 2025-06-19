import fastf1
import pandas as pd
from datetime import datetime
import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from supabase_client import supabase

def fetch_and_store_races(year):
    """
    Fetch race data for a given year and store it in Supabase
    """
    # Enable cache
    fastf1.Cache.enable_cache('cache')
    
    # Load the season
    season = fastf1.get_event_schedule(year)
    
    # Convert to DataFrame
    races_df = pd.DataFrame(season)
    
    # Print column names for debugging
    print("Available columns:", races_df.columns.tolist())
    
    # Prepare data for Supabase
    races_data = []
    for _, race in races_df.iterrows():
        # Skip pre-season tests
        if 'Test' in race['EventName']:
            continue
        race_data = {
            'year': year,
            'round': race['RoundNumber'],
            'race_name': race['EventName'],
            'circuit_name': race['Location'],
            'country': race['Country'],
            'date': race['EventDate'].strftime('%Y-%m-%d'),
            'fp1_date': race['Session1Date'].strftime('%Y-%m-%d %H:%M:%S') if pd.notna(race['Session1Date']) else None,
            'fp2_date': race['Session2Date'].strftime('%Y-%m-%d %H:%M:%S') if pd.notna(race['Session2Date']) else None,
            'fp3_date': race['Session3Date'].strftime('%Y-%m-%d %H:%M:%S') if pd.notna(race['Session3Date']) else None,
            'qualifying_date': race['Session4Date'].strftime('%Y-%m-%d %H:%M:%S') if pd.notna(race['Session4Date']) else None,
            'sprint_date': None,
            'race_date': race['Session5Date'].strftime('%Y-%m-%d %H:%M:%S') if pd.notna(race['Session5Date']) else None
        }
        races_data.append(race_data)
    
    # Store in Supabase
    for race in races_data:
        try:
            # Upsert the race data
            result = supabase.table('races').upsert(race).execute()
            print(f"Stored race: {race['race_name']} ({race['year']} Round {race['round']})")
        except Exception as e:
            print(f"Error storing race {race['race_name']}: {str(e)}")

if __name__ == "__main__":
    # Fetch races for the last few years
    current_year = datetime.now().year
    for year in range(current_year - 5, current_year + 1):
        print(f"\nFetching races for {year}...")
        fetch_and_store_races(year) 