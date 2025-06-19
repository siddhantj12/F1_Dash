import sys
import os
import fastf1
import pandas as pd
from datetime import datetime

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from supabase_client import supabase

def fetch_and_store_seasons(start_year=2020, end_year=None):
    """
    Fetch and store seasons data for the specified year range
    """
    if end_year is None:
        end_year = datetime.now().year
    
    # Enable caching
    fastf1.Cache.enable_cache('cache')
    
    for year in range(start_year, end_year + 1):
        try:
            print(f"Processing season {year}...")
            
            # Create season data
            season_data = {
                'year': year,
                'season_name': f'{year} Formula 1 World Championship',
                'total_races': 0,  # Will be updated when races are processed
                'created_at': datetime.utcnow().isoformat()
            }
            
            # Try to get event schedule to count races
            try:
                schedule = fastf1.get_event_schedule(year)
                # Count only race events (exclude tests)
                race_events = schedule[~schedule['EventName'].str.contains('Test', case=False, na=False)]
                season_data['total_races'] = len(race_events)
            except:
                # If we can't get the schedule, set to 0
                season_data['total_races'] = 0
            
            # Store in Supabase
            try:
                result = supabase.table('seasons').upsert(
                    season_data,
                    on_conflict='year'
                ).execute()
                print(f"✅ Stored season {year}")
            except Exception as e:
                print(f"❌ Error storing season {year}: {str(e)}")
                
        except Exception as e:
            print(f"❌ Error processing season {year}: {str(e)}")
            continue

if __name__ == "__main__":
    fetch_and_store_seasons() 