"""
Migrate FastF1 telemetry data to Supabase.

Fill in your Supabase credentials below or set them as environment variables:
    SUPABASE_URL
    SUPABASE_KEY
"""
import os
import fastf1
from fastf1 import events
import pandas as pd
from supabase import create_client, Client

SUPABASE_URL = "https://fnocabpmplyjfwswrpob.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZub2NhYnBtcGx5amZ3c3dycG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyODEyNzcsImV4cCI6MjA2NTg1NzI3N30.ILSBclGorcyaB2NTZ1RvZlP62g7uaKmKQIEEGd4iID4"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

YEARS = range(2020, 2026)
SESSION_TYPES = [
    'Practice 1', 'Practice 2', 'Practice 3',
    'Sprint Shootout', 'Sprint',
    'Qualifying', 'Race'
]

def get_lap_id(year, round_number, driver_code, lap_number):
    lap_number = int(lap_number)  # Ensure lap_number is int
    resp = supabase.table('laps').select('id').eq('lap_number', lap_number).eq('driver_code', driver_code)
    data = resp.execute().data
    for lap in data:
        return lap['id']
    return None

def migrate_telemetry():
    for year in YEARS:
        print(f"\n=== {year} ===")
        try:
            event_schedule = events.get_event_schedule(year)
        except Exception as e:
            print(f"Could not get event schedule for {year}: {e}")
            continue
        for idx, event in event_schedule.iterrows():
            round_number = event['RoundNumber']
            event_name = event['EventName']
            print(f"\n{event_name} (Round {round_number})")
            for session_type in SESSION_TYPES:
                try:
                    print(f"  {session_type}...", end=" ")
                    session = fastf1.get_session(year, round_number, session_type)
                    session.load(telemetry=True, laps=True, weather=False)
                    laps = session.laps
                    for _, lap in laps.iterrows():
                        driver_code = lap['Driver']
                        lap_number = int(lap['LapNumber'])  # Ensure lap_number is int
                        lap_id = get_lap_id(year, round_number, driver_code, lap_number)
                        if not lap_id:
                            print(f"Lap not found in Supabase: {year} R{round_number} {driver_code} Lap {lap_number}")
                            continue
                        tel = lap.get_car_data()
                        if tel is None or tel.empty:
                            continue
                        for i, row in tel.iterrows():
                            data = {
                                'lap_id': lap_id,
                                'timestamp': row['Time'].to_pydatetime() if hasattr(row['Time'], 'to_pydatetime') else row['Time'],
                                'speed': row.get('Speed'),
                                'throttle': row.get('Throttle'),
                                'brake': row.get('Brake'),
                                'gear': row.get('Gear'),
                            }
                            try:
                                supabase.table('telemetry').insert(data).execute()
                            except Exception as e:
                                print(f"    Error inserting telemetry: {e}")
                    print("OK")
                except Exception as e:
                    print(f"Not available or error: {e}")

if __name__ == "__main__":
    migrate_telemetry() 