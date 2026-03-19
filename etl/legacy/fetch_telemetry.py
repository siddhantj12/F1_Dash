import sys
import os
import fastf1
import pandas as pd
from datetime import datetime
import numpy as np

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from supabase_client import supabase

def fetch_and_store_telemetry(year, sample_rate=0.1):
    """
    Fetch and store telemetry data for a specific year
    sample_rate: Fraction of telemetry points to store (0.1 = 10% of data)
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
                
                print(f"Processing telemetry for {year} Round {round_num}: {event_name}")
                
                # Get telemetry data for race session
                try:
                    # Load race session
                    session_data = fastf1.get_session(year, round_num, 'R')
                    session_data.load(telemetry=True, weather=False, messages=False)
                    
                    # Get all drivers
                    drivers = session_data.drivers
                    
                    for driver in drivers:
                        try:
                            # Get driver telemetry
                            driver_telemetry = session_data.laps.pick_driver(driver).get_telemetry()
                            
                            if driver_telemetry is not None and not driver_telemetry.empty:
                                # Sample the telemetry data to reduce size
                                sampled_telemetry = driver_telemetry.sample(frac=sample_rate, random_state=42)
                                
                                # Process each sampled point
                                for idx, row in sampled_telemetry.iterrows():
                                    try:
                                        telemetry_data = {
                                            'year': year,
                                            'round': round_num,
                                            'driver_number': int(driver),
                                            'event_name': event_name,
                                            'session': 'R',
                                            'timestamp': row.name.isoformat() if hasattr(row.name, 'isoformat') else None,
                                            'lap_number': int(row['LapNumber']) if 'LapNumber' in row else None,
                                            'sector': int(row['Sector']) if 'Sector' in row else None,
                                            'speed': float(row['Speed']) if 'Speed' in row else None,
                                            'throttle': float(row['Throttle']) if 'Throttle' in row else None,
                                            'brake': float(row['Brake']) if 'Brake' in row else None,
                                            'gear': int(row['Gear']) if 'Gear' in row else None,
                                            'rpm': float(row['RPM']) if 'RPM' in row else None,
                                            'drs': int(row['DRS']) if 'DRS' in row else None,
                                            'distance': float(row['Distance']) if 'Distance' in row else None,
                                            'x': float(row['X']) if 'X' in row else None,
                                            'y': float(row['Y']) if 'Y' in row else None,
                                            'z': float(row['Z']) if 'Z' in row else None,
                                            'created_at': datetime.utcnow().isoformat()
                                        }
                                        
                                        # Clean NaN values
                                        for key, value in telemetry_data.items():
                                            if pd.isna(value) or value is None:
                                                telemetry_data[key] = None
                                        
                                        # Store in Supabase
                                        try:
                                            result = supabase.table('telemetry').insert(telemetry_data).execute()
                                            print(f"  ✅ Stored telemetry point for driver {driver}")
                                        except Exception as e:
                                            print(f"  ❌ Error storing telemetry for driver {driver}: {str(e)}")
                                            break  # Stop processing this driver if there's an error
                                            
                                    except Exception as e:
                                        print(f"  ❌ Error processing telemetry point: {str(e)}")
                                        continue
                                        
                            else:
                                print(f"  ⚠️ No telemetry data available for driver {driver}")
                                
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