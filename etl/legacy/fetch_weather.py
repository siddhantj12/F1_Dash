import sys
import os
import fastf1
import pandas as pd
from datetime import datetime
import numpy as np

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from supabase_client import supabase

def fetch_and_store_weather(year):
    """
    Fetch and store weather data for a specific year
    """
    # Enable caching
    fastf1.Cache.enable_cache('cache')
    
    try:
        # Load event schedule
        schedule = fastf1.get_event_schedule(year)
        
        # Filter out test events
        race_events = schedule[~schedule['EventName'].str.contains('Test', case=False, na=False)]
        
        for _, event in race_events.iterrows():
            try:
                event_name = event['EventName']
                round_num = event['RoundNumber']
                
                print(f"Processing weather for {year} Round {round_num}: {event_name}")
                
                # Get weather data for different sessions
                sessions = ['FP1', 'FP2', 'FP3', 'Q', 'R']
                
                for session in sessions:
                    try:
                        # Load session
                        session_data = fastf1.get_session(year, round_num, session)
                        session_data.load(weather=True)
                        
                        # Get weather data
                        weather_data = session_data.weather_data
                        
                        if weather_data is not None and not weather_data.empty:
                            # Aggregate weather data (take mean values for the session)
                            avg_weather = {
                                'year': year,
                                'round': round_num,
                                'session': session,
                                'event_name': event_name,
                                'air_temperature': float(weather_data['AirTemp'].mean()) if 'AirTemp' in weather_data.columns else None,
                                'track_temperature': float(weather_data['TrackTemp'].mean()) if 'TrackTemp' in weather_data.columns else None,
                                'humidity': float(weather_data['Humidity'].mean()) if 'Humidity' in weather_data.columns else None,
                                'pressure': float(weather_data['Pressure'].mean()) if 'Pressure' in weather_data.columns else None,
                                'wind_speed': float(weather_data['WindSpeed'].mean()) if 'WindSpeed' in weather_data.columns else None,
                                'wind_direction': float(weather_data['WindDirection'].mean()) if 'WindDirection' in weather_data.columns else None,
                                'rainfall': float(weather_data['Rainfall'].sum()) if 'Rainfall' in weather_data.columns else None,
                                'session_start': session_data.date.isoformat() if hasattr(session_data, 'date') else None,
                                'created_at': datetime.utcnow().isoformat()
                            }
                            
                            # Clean NaN values
                            for key, value in avg_weather.items():
                                if pd.isna(value) or value is None:
                                    avg_weather[key] = None
                            
                            # Store in Supabase
                            try:
                                result = supabase.table('weather').upsert(
                                    avg_weather,
                                    on_conflict='year,round,session'
                                ).execute()
                                print(f"  ✅ Stored weather for {session}")
                            except Exception as e:
                                print(f"  ❌ Error storing weather for {session}: {str(e)}")
                        else:
                            print(f"  ⚠️ No weather data available for {session}")
                            
                    except Exception as e:
                        print(f"  ❌ Error processing {session}: {str(e)}")
                        continue
                        
            except Exception as e:
                print(f"❌ Error processing event {event_name}: {str(e)}")
                continue
                
    except Exception as e:
        print(f"❌ Error loading schedule for year {year}: {str(e)}")

if __name__ == "__main__":
    # Process current year and previous 3 years
    current_year = datetime.now().year
    for year in range(current_year - 3, current_year + 1):
        print(f"\n{'='*50}")
        print(f"Processing weather for year {year}")
        print(f"{'='*50}")
        fetch_and_store_weather(year) 