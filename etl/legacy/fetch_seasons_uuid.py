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
            
            # Create season data - using year as primary key
            season_data = {
                'year': year
            }
            
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