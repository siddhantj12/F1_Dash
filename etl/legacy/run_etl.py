import os
from datetime import datetime
from fetch_races import fetch_and_store_races
from fetch_drivers import fetch_and_store_drivers
from fetch_lap_times import fetch_all_lap_times
import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from supabase_client import supabase

def run_etl():
    """
    Run the complete ETL process
    """
    # Create cache directory if it doesn't exist
    if not os.path.exists('cache'):
        os.makedirs('cache')
    
    # Get current year
    current_year = datetime.now().year
    
    # Define the range of years to process
    years = range(current_year - 5, current_year + 1)
    
    # Process each year
    for year in years:
        print(f"\n{'='*50}")
        print(f"Processing year {year}")
        print(f"{'='*50}")
        
        try:
            # Fetch and store races
            print("\nFetching races...")
            fetch_and_store_races(year)
            print("Races completed")
            
            # Fetch and store drivers
            print("\nFetching drivers...")
            fetch_and_store_drivers(year)
            print("Drivers completed")
            
            # Fetch and store lap times
            print("\nFetching lap times...")
            fetch_all_lap_times(year)
            print("Lap times completed")
            
            print(f"\nCompleted processing year {year}")
        except Exception as e:
            print(f"Error processing year {year}: {str(e)}")
            print("Continuing with next year...")

if __name__ == "__main__":
    run_etl() 