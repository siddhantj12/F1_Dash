import sys
import os
import fastf1
import pandas as pd
from datetime import datetime
import numpy as np

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from supabase_client import supabase

def get_or_create_race(year, round_num, event_name, circuit_name, date):
    """
    Get existing race or create new one
    """
    try:
        # Check if race exists
        result = supabase.table('races').select('id').eq('year', year).eq('round', round_num).execute()
        
        if result.data:
            return result.data[0]['id']
        else:
            # Create new race
            race_data = {
                'year': year,
                'round': round_num,
                'name': event_name,
                'circuit': circuit_name,
                'date': date.isoformat() if date else None
            }
            
            result = supabase.table('races').insert(race_data).execute()
            return result.data[0]['id']
            
    except Exception as e:
        print(f"❌ Error with race {year} Round {round_num}: {str(e)}")
        return None

def get_or_create_session(race_id, session_type, start_time):
    """
    Get existing session or create new one
    """
    try:
        # Check if session exists
        result = supabase.table('sessions').select('id').eq('race_id', race_id).eq('type', session_type).execute()
        
        if result.data:
            return result.data[0]['id']
        else:
            # Create new session
            session_data = {
                'race_id': race_id,
                'type': session_type,
                'start_time': start_time.isoformat() if start_time else None
            }
            
            result = supabase.table('sessions').insert(session_data).execute()
            return result.data[0]['id']
            
    except Exception as e:
        print(f"❌ Error with session {session_type}: {str(e)}")
        return None

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
                circuit_name = event['Location'] if 'Location' in event else event.get('CircuitName', 'Unknown')
                
                # Get race date
                race_date = None
                if 'Session5Date' in event and pd.notna(event['Session5Date']):
                    race_date = event['Session5Date']
                
                print(f"\nProcessing weather for {year} Round {round_num}: {event_name}")
                
                # Get or create race
                race_id = get_or_create_race(year, round_num, event_name, circuit_name, race_date)
                if not race_id:
                    continue
                
                # Dynamically detect all session columns in the event
                session_columns = [col for col in event.index if col.startswith('Session') and 'Name' not in col and pd.notna(event[col])]
                print(f"  Detected session columns: {session_columns}")
                for session_col in session_columns:
                    session_name_col = session_col + 'Name'
                    session_key = event[session_col]
                    session_name = event[session_name_col] if session_name_col in event and pd.notna(event[session_name_col]) else session_key
                    print(f"  Trying session: key='{session_key}', name='{session_name}'")
                    tried = False
                    for try_key in [session_key, session_name]:
                        if not isinstance(try_key, str) or not try_key.strip():
                            continue
                        try:
                            session_data = fastf1.get_session(year, round_num, try_key)
                            session_data.load(weather=True)
                            weather_data = session_data.weather_data
                            if weather_data is not None and not weather_data.empty:
                                print(f"    ✅ Weather data found for {try_key}")
                                session_id = get_or_create_session(race_id, try_key, session_data.date)
                                if not session_id:
                                    continue
                                sampled_weather = weather_data.sample(frac=0.1, random_state=42) if len(weather_data) > 10 else weather_data
                                for timestamp, row in sampled_weather.iterrows():
                                    try:
                                        weather_point = {
                                            'session_id': session_id,
                                            'timestamp': timestamp.isoformat() if hasattr(timestamp, 'isoformat') else None,
                                            'air_temperature': float(row['AirTemp']) if 'AirTemp' in row and pd.notna(row['AirTemp']) else None,
                                            'track_temperature': float(row['TrackTemp']) if 'TrackTemp' in row and pd.notna(row['TrackTemp']) else None,
                                            'humidity': float(row['Humidity']) if 'Humidity' in row and pd.notna(row['Humidity']) else None,
                                            'pressure': float(row['Pressure']) if 'Pressure' in row and pd.notna(row['Pressure']) else None,
                                            'wind_speed': float(row['WindSpeed']) if 'WindSpeed' in row and pd.notna(row['WindSpeed']) else None,
                                            'wind_direction': float(row['WindDirection']) if 'WindDirection' in row and pd.notna(row['WindDirection']) else None,
                                            'rainfall': float(row['Rainfall']) if 'Rainfall' in row and pd.notna(row['Rainfall']) else None
                                        }
                                        result = supabase.table('weather').insert(weather_point).execute()
                                        print(f"      ✅ Stored weather point for {try_key}")
                                    except Exception as e:
                                        print(f"      ❌ Error storing weather point: {str(e)}")
                                        continue
                                tried = True
                                break
                            else:
                                print(f"    ⚠️ No weather data for {try_key}")
                        except Exception as e:
                            print(f"    ❌ Error loading session {try_key}: {str(e)}")
                            continue
                    if not tried:
                        print(f"    ❌ No weather data found for any key for this session.")
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