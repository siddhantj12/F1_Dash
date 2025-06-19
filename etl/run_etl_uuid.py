import os
from datetime import datetime
from fetch_seasons_uuid import fetch_and_store_seasons
from fetch_weather_uuid import fetch_and_store_weather
from fetch_telemetry_uuid import fetch_and_store_telemetry
import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from supabase_client import supabase

def run_uuid_etl():
    """
    Run the ETL process for seasons, weather, and telemetry using UUID-based schema.
    """
    # Create cache directory if it doesn't exist
    if not os.path.exists('cache'):
        os.makedirs('cache')
    
    # Get current year
    current_year = datetime.now().year
    # Define the range of years to process
    years = range(current_year - 5, current_year + 2)
    
    print("🚀 Starting UUID-based ETL for Seasons, Weather, and Telemetry")
    print("=" * 60)
    
    # Step 1: Process seasons (one-time setup)
    print("\n📅 Step 1: Processing Seasons...")
    try:
        fetch_and_store_seasons(min(years), max(years))
        print("✅ Seasons completed")
    except Exception as e:
        print(f"❌ Error processing seasons: {str(e)}")
    
    # Step 2: Process each year
    for year in years:
        print(f"\n{'='*50}")
        print(f"Processing year {year}")
        print(f"{'='*50}")
        try:
            # Fetch and store weather (only for recent years due to data availability)
            if year <= current_year and year >= current_year - 3:
                print("\n🌤️ Fetching weather...")
                fetch_and_store_weather(year)
                print("✅ Weather completed")
            else:
                print("Skipping weather for year", year)
            
            # Fetch and store telemetry (only for recent years due to data size)
            if year <= current_year and year >= current_year - 2:
                print("\n📊 Fetching telemetry...")
                fetch_and_store_telemetry(year, sample_rate=0.05)  # 5% sample rate
                print("✅ Telemetry completed")
            else:
                print("Skipping telemetry for year", year)
            
            print(f"\n🎉 Completed processing year {year}")
        except Exception as e:
            print(f"❌ Error processing year {year}: {str(e)}")
            print("Continuing with next year...")
    
    print("\n" + "=" * 60)
    print("🎯 UUID-based ETL for Seasons, Weather, and Telemetry Completed!")
    print("=" * 60)

if __name__ == "__main__":
    run_uuid_etl() 