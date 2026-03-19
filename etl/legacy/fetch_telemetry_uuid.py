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

def get_or_create_driver(driver_code, driver_number, driver_name, team_name):
    """
    Get existing driver or create new one
    """
    try:
        # Check if driver exists
        result = supabase.table('drivers').select('code').eq('code', driver_code).execute()
        
        if result.data:
            return driver_code
        else:
            # Create new driver
            driver_data = {
                'code': driver_code,
                'number': str(driver_number),
                'name': driver_name,
                'team': team_name,
                'color': '#000000'  # Default color
            }
            
            result = supabase.table('drivers').insert(driver_data).execute()
            return driver_code
            
    except Exception as e:
        print(f"❌ Error with driver {driver_code}: {str(e)}")
        return None

def get_or_create_lap(session_id, driver_code, lap_number, lap_time, sector1, sector2, sector3, compound):
    """
    Get existing lap or create new one
    """
    try:
        # Check if lap exists
        result = supabase.table('laps').select('id').eq('session_id', session_id).eq('driver_code', driver_code).eq('lap_number', lap_number).execute()
        
        if result.data:
            return result.data[0]['id']
        else:
            # Create new lap
            lap_data = {
                'session_id': session_id,
                'driver_code': driver_code,
                'lap_number': lap_number,
                'lap_time': str(lap_time) if lap_time else None,
                'sector1': str(sector1) if sector1 else None,
                'sector2': str(sector2) if sector2 else None,
                'sector3': str(sector3) if sector3 else None,
                'compound': compound
            }
            
            result = supabase.table('laps').insert(lap_data).execute()
            return result.data[0]['id']
            
    except Exception as e:
        print(f"❌ Error with lap {lap_number}: {str(e)}")
        return None

def fetch_and_store_telemetry(year, sample_rate=0.05):
    """
    Fetch and store telemetry data for a specific year
    sample_rate: Fraction of telemetry points to store (0.05 = 5% of data)
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
                
                print(f"Processing telemetry for {year} Round {round_num}: {event_name}")
                
                # Get or create race
                race_id = get_or_create_race(year, round_num, event_name, circuit_name, race_date)
                if not race_id:
                    continue
                
                # Get telemetry data for race session
                try:
                    # Load race session
                    session_data = fastf1.get_session(year, round_num, 'R')
                    session_data.load(telemetry=True, weather=False, messages=False)
                    
                    # Get or create session
                    session_id = get_or_create_session(race_id, 'Race', session_data.date)
                    if not session_id:
                        continue
                    
                    # Get all drivers
                    drivers = session_data.drivers
                    
                    for driver in drivers:
                        try:
                            # Get driver info
                            driver_info = session_data.results.pick_driver(driver)
                            driver_code = driver_info['Abbreviation'].iloc[0] if 'Abbreviation' in driver_info.columns else str(driver)
                            driver_name = f"{driver_info['FirstName'].iloc[0]} {driver_info['LastName'].iloc[0]}" if 'FirstName' in driver_info.columns else f"Driver {driver}"
                            team_name = driver_info['TeamName'].iloc[0] if 'TeamName' in driver_info.columns else "Unknown"
                            
                            # Get or create driver
                            driver_code = get_or_create_driver(driver_code, driver, driver_name, team_name)
                            if not driver_code:
                                continue
                            
                            # Get driver telemetry
                            driver_telemetry = session_data.laps.pick_driver(driver).get_telemetry()
                            
                            if driver_telemetry is not None and not driver_telemetry.empty:
                                # Sample the telemetry data to reduce size
                                sampled_telemetry = driver_telemetry.sample(frac=sample_rate, random_state=42)
                                
                                # Group by lap for processing
                                for lap_number in sampled_telemetry['LapNumber'].unique():
                                    lap_telemetry = sampled_telemetry[sampled_telemetry['LapNumber'] == lap_number]
                                    
                                    # Get lap info
                                    lap_info = session_data.laps.pick_driver(driver).pick_lap(lap_number)
                                    lap_time = lap_info['LapTime'].iloc[0] if 'LapTime' in lap_info.columns else None
                                    sector1 = lap_info['Sector1Time'].iloc[0] if 'Sector1Time' in lap_info.columns else None
                                    sector2 = lap_info['Sector2Time'].iloc[0] if 'Sector2Time' in lap_info.columns else None
                                    sector3 = lap_info['Sector3Time'].iloc[0] if 'Sector3Time' in lap_info.columns else None
                                    compound = lap_info['Compound'].iloc[0] if 'Compound' in lap_info.columns else None
                                    
                                    # Get or create lap
                                    lap_id = get_or_create_lap(session_id, driver_code, lap_number, lap_time, sector1, sector2, sector3, compound)
                                    if not lap_id:
                                        continue
                                    
                                    # Process telemetry points for this lap
                                    for timestamp, row in lap_telemetry.iterrows():
                                        try:
                                            telemetry_point = {
                                                'lap_id': lap_id,
                                                'timestamp': timestamp.isoformat() if hasattr(timestamp, 'isoformat') else None,
                                                'speed': float(row['Speed']) if 'Speed' in row and pd.notna(row['Speed']) else None,
                                                'throttle': float(row['Throttle']) if 'Throttle' in row and pd.notna(row['Throttle']) else None,
                                                'brake': float(row['Brake']) if 'Brake' in row and pd.notna(row['Brake']) else None,
                                                'gear': int(row['Gear']) if 'Gear' in row and pd.notna(row['Gear']) else None
                                            }
                                            
                                            # Store in Supabase
                                            result = supabase.table('telemetry').insert(telemetry_point).execute()
                                            print(f"  ✅ Stored telemetry point for driver {driver_code} lap {lap_number}")
                                            
                                        except Exception as e:
                                            print(f"  ❌ Error storing telemetry point: {str(e)}")
                                            continue
                                            
                        except Exception as e:
                            print(f"  ❌ Error processing driver {driver}: {str(e)}")
                            continue
                            
                except Exception as e:
                    print(f"  ❌ Error loading race session: {str(e)}")
                    continue
                    
            except Exception as e:
                print(f"❌ Error processing event {event_name}: {str(e)}")
                continue
                
    except Exception as e:
        print(f"❌ Error loading schedule for year {year}: {str(e)}")

if __name__ == "__main__":
    # Process current year and previous 2 years (telemetry is data-intensive)
    current_year = datetime.now().year
    for year in range(current_year - 2, current_year + 1):
        print(f"\n{'='*50}")
        print(f"Processing telemetry for year {year}")
        print(f"{'='*50}")
        fetch_and_store_telemetry(year, sample_rate=0.05)  # Store 5% of telemetry data 