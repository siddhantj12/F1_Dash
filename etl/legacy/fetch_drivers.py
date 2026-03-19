import fastf1
import pandas as pd
from datetime import datetime
import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from supabase_client import supabase

def fetch_and_store_drivers(year):
    """
    Fetch driver data for a given year and store it in Supabase
    """
    # Enable cache
    fastf1.Cache.enable_cache('cache')
    
    # Load the season
    season = fastf1.get_event_schedule(year)
    
    # Get the first race of the season to fetch driver info
    for _, event in season.iterrows():
        if 'Test' not in event['EventName']:
            first_race = event
            break
    else:
        print(f"No race event found for {year}")
        return
    session = fastf1.get_session(year, first_race['RoundNumber'], 'R')
    session.load()
    
    # Get driver info from session results
    drivers_df = session.results
    if drivers_df is None:
        print(f"No driver results found for {year} round {first_race['RoundNumber']}")
        return
    
    # Prepare data for Supabase
    drivers_data = []
    for _, driver in drivers_df.iterrows():
        driver_data = {
            'year': year,
            'driver_number': driver['DriverNumber'],
            'driver_code': driver['Abbreviation'],
            'first_name': driver['FirstName'],
            'last_name': driver['LastName'],
            'team_name': driver['TeamName'],
            'country_code': driver['CountryCode'] if 'CountryCode' in driver else None
        }
        drivers_data.append(driver_data)
    
    # Store in Supabase
    for driver in drivers_data:
        try:
            # Upsert the driver data
            result = supabase.table('drivers').upsert(driver).execute()
            print(f"Stored driver: {driver['first_name']} {driver['last_name']} ({driver['year']})")
        except Exception as e:
            print(f"Error storing driver {driver['first_name']} {driver['last_name']}: {str(e)}")

if __name__ == "__main__":
    # Fetch drivers for the last few years
    current_year = datetime.now().year
    for year in range(current_year - 5, current_year + 1):
        print(f"\nFetching drivers for {year}...")
        fetch_and_store_drivers(year) 