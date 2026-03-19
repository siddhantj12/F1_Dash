import os
import re
import unicodedata
import pandas as pd
from supabase import Client
from supabase_setup import supabase as supabase_client
import fastf1

supabase: Client = supabase_client

CACHE_DIR = 'cache'

# --- BEGIN: Supabase authoritative race list (full, 2020–2025) ---
supabase_races = [
    # 2020
    {"year": 2020, "round": 1, "race_name": "Austrian Grand Prix"},
    {"year": 2020, "round": 2, "race_name": "Styrian Grand Prix"},
    {"year": 2020, "round": 3, "race_name": "Hungarian Grand Prix"},
    {"year": 2020, "round": 4, "race_name": "British Grand Prix"},
    {"year": 2020, "round": 5, "race_name": "70th Anniversary Grand Prix"},
    {"year": 2020, "round": 6, "race_name": "Spanish Grand Prix"},
    {"year": 2020, "round": 7, "race_name": "Belgian Grand Prix"},
    {"year": 2020, "round": 8, "race_name": "Italian Grand Prix"},
    {"year": 2020, "round": 9, "race_name": "Tuscan Grand Prix"},
    {"year": 2020, "round": 10, "race_name": "Russian Grand Prix"},
    {"year": 2020, "round": 11, "race_name": "Eifel Grand Prix"},
    {"year": 2020, "round": 12, "race_name": "Portuguese Grand Prix"},
    {"year": 2020, "round": 13, "race_name": "Emilia Romagna Grand Prix"},
    {"year": 2020, "round": 14, "race_name": "Turkish Grand Prix"},
    {"year": 2020, "round": 15, "race_name": "Bahrain Grand Prix"},
    {"year": 2020, "round": 16, "race_name": "Sakhir Grand Prix"},
    {"year": 2020, "round": 17, "race_name": "Abu Dhabi Grand Prix"},
    # 2021
    {"year": 2021, "round": 1, "race_name": "Bahrain Grand Prix"},
    {"year": 2021, "round": 2, "race_name": "Emilia Romagna Grand Prix"},
    {"year": 2021, "round": 3, "race_name": "Portuguese Grand Prix"},
    {"year": 2021, "round": 4, "race_name": "Spanish Grand Prix"},
    {"year": 2021, "round": 5, "race_name": "Monaco Grand Prix"},
    {"year": 2021, "round": 6, "race_name": "Azerbaijan Grand Prix"},
    {"year": 2021, "round": 7, "race_name": "French Grand Prix"},
    {"year": 2021, "round": 8, "race_name": "Styrian Grand Prix"},
    {"year": 2021, "round": 9, "race_name": "Austrian Grand Prix"},
    {"year": 2021, "round": 10, "race_name": "British Grand Prix"},
    {"year": 2021, "round": 11, "race_name": "Hungarian Grand Prix"},
    {"year": 2021, "round": 12, "race_name": "Belgian Grand Prix"},
    {"year": 2021, "round": 13, "race_name": "Dutch Grand Prix"},
    {"year": 2021, "round": 14, "race_name": "Italian Grand Prix"},
    {"year": 2021, "round": 15, "race_name": "Russian Grand Prix"},
    {"year": 2021, "round": 16, "race_name": "Turkish Grand Prix"},
    {"year": 2021, "round": 17, "race_name": "United States Grand Prix"},
    {"year": 2021, "round": 18, "race_name": "Mexico City Grand Prix"},
    {"year": 2021, "round": 19, "race_name": "São Paulo Grand Prix"},
    {"year": 2021, "round": 20, "race_name": "Qatar Grand Prix"},
    {"year": 2021, "round": 21, "race_name": "Saudi Arabian Grand Prix"},
    {"year": 2021, "round": 22, "race_name": "Abu Dhabi Grand Prix"},
    # 2022
    {"year": 2022, "round": 1, "race_name": "Bahrain Grand Prix"},
    {"year": 2022, "round": 2, "race_name": "Saudi Arabian Grand Prix"},
    {"year": 2022, "round": 3, "race_name": "Australian Grand Prix"},
    {"year": 2022, "round": 4, "race_name": "Emilia Romagna Grand Prix"},
    {"year": 2022, "round": 5, "race_name": "Miami Grand Prix"},
    {"year": 2022, "round": 6, "race_name": "Spanish Grand Prix"},
    {"year": 2022, "round": 7, "race_name": "Monaco Grand Prix"},
    {"year": 2022, "round": 8, "race_name": "Azerbaijan Grand Prix"},
    {"year": 2022, "round": 9, "race_name": "Canadian Grand Prix"},
    {"year": 2022, "round": 10, "race_name": "British Grand Prix"},
    {"year": 2022, "round": 11, "race_name": "Austrian Grand Prix"},
    {"year": 2022, "round": 12, "race_name": "French Grand Prix"},
    {"year": 2022, "round": 13, "race_name": "Hungarian Grand Prix"},
    {"year": 2022, "round": 14, "race_name": "Belgian Grand Prix"},
    {"year": 2022, "round": 15, "race_name": "Dutch Grand Prix"},
    {"year": 2022, "round": 16, "race_name": "Italian Grand Prix"},
    {"year": 2022, "round": 17, "race_name": "Singapore Grand Prix"},
    {"year": 2022, "round": 18, "race_name": "Japanese Grand Prix"},
    {"year": 2022, "round": 19, "race_name": "United States Grand Prix"},
    {"year": 2022, "round": 20, "race_name": "Mexico City Grand Prix"},
    {"year": 2022, "round": 21, "race_name": "São Paulo Grand Prix"},
    {"year": 2022, "round": 22, "race_name": "Abu Dhabi Grand Prix"},
    # 2023
    {"year": 2023, "round": 1, "race_name": "Bahrain Grand Prix"},
    {"year": 2023, "round": 2, "race_name": "Saudi Arabian Grand Prix"},
    {"year": 2023, "round": 3, "race_name": "Australian Grand Prix"},
    {"year": 2023, "round": 4, "race_name": "Azerbaijan Grand Prix"},
    {"year": 2023, "round": 5, "race_name": "Miami Grand Prix"},
    {"year": 2023, "round": 6, "race_name": "Monaco Grand Prix"},
    {"year": 2023, "round": 7, "race_name": "Spanish Grand Prix"},
    {"year": 2023, "round": 8, "race_name": "Canadian Grand Prix"},
    {"year": 2023, "round": 9, "race_name": "Austrian Grand Prix"},
    {"year": 2023, "round": 10, "race_name": "British Grand Prix"},
    {"year": 2023, "round": 11, "race_name": "Hungarian Grand Prix"},
    {"year": 2023, "round": 12, "race_name": "Belgian Grand Prix"},
    {"year": 2023, "round": 13, "race_name": "Dutch Grand Prix"},
    {"year": 2023, "round": 14, "race_name": "Italian Grand Prix"},
    {"year": 2023, "round": 15, "race_name": "Singapore Grand Prix"},
    {"year": 2023, "round": 16, "race_name": "Japanese Grand Prix"},
    {"year": 2023, "round": 17, "race_name": "Qatar Grand Prix"},
    {"year": 2023, "round": 18, "race_name": "United States Grand Prix"},
    {"year": 2023, "round": 19, "race_name": "Mexico City Grand Prix"},
    {"year": 2023, "round": 20, "race_name": "São Paulo Grand Prix"},
    {"year": 2023, "round": 21, "race_name": "Las Vegas Grand Prix"},
    {"year": 2023, "round": 22, "race_name": "Abu Dhabi Grand Prix"},
    # 2024
    {"year": 2024, "round": 1, "race_name": "Bahrain Grand Prix"},
    {"year": 2024, "round": 2, "race_name": "Saudi Arabian Grand Prix"},
    {"year": 2024, "round": 3, "race_name": "Australian Grand Prix"},
    {"year": 2024, "round": 4, "race_name": "Japanese Grand Prix"},
    {"year": 2024, "round": 5, "race_name": "Chinese Grand Prix"},
    {"year": 2024, "round": 6, "race_name": "Miami Grand Prix"},
    {"year": 2024, "round": 7, "race_name": "Emilia Romagna Grand Prix"},
    {"year": 2024, "round": 8, "race_name": "Monaco Grand Prix"},
    {"year": 2024, "round": 9, "race_name": "Canadian Grand Prix"},
    {"year": 2024, "round": 10, "race_name": "Spanish Grand Prix"},
    {"year": 2024, "round": 11, "race_name": "Austrian Grand Prix"},
    {"year": 2024, "round": 12, "race_name": "British Grand Prix"},
    {"year": 2024, "round": 13, "race_name": "Hungarian Grand Prix"},
    {"year": 2024, "round": 14, "race_name": "Belgian Grand Prix"},
    {"year": 2024, "round": 15, "race_name": "Dutch Grand Prix"},
    {"year": 2024, "round": 16, "race_name": "Italian Grand Prix"},
    {"year": 2024, "round": 17, "race_name": "Azerbaijan Grand Prix"},
    {"year": 2024, "round": 18, "race_name": "Singapore Grand Prix"},
    {"year": 2024, "round": 19, "race_name": "United States Grand Prix"},
    {"year": 2024, "round": 20, "race_name": "Mexico City Grand Prix"},
    {"year": 2024, "round": 21, "race_name": "São Paulo Grand Prix"},
    {"year": 2024, "round": 22, "race_name": "Las Vegas Grand Prix"},
    {"year": 2024, "round": 23, "race_name": "Qatar Grand Prix"},
    {"year": 2024, "round": 24, "race_name": "Abu Dhabi Grand Prix"},
    # 2025
    {"year": 2025, "round": 1, "race_name": "Australian Grand Prix"},
    {"year": 2025, "round": 2, "race_name": "Chinese Grand Prix"},
    {"year": 2025, "round": 3, "race_name": "Japanese Grand Prix"},
    {"year": 2025, "round": 4, "race_name": "Bahrain Grand Prix"},
    {"year": 2025, "round": 5, "race_name": "Saudi Arabian Grand Prix"},
    {"year": 2025, "round": 6, "race_name": "Miami Grand Prix"},
    {"year": 2025, "round": 7, "race_name": "Emilia Romagna Grand Prix"},
    {"year": 2025, "round": 8, "race_name": "Monaco Grand Prix"},
    {"year": 2025, "round": 9, "race_name": "Spanish Grand Prix"},
    {"year": 2025, "round": 10, "race_name": "Canadian Grand Prix"},
    {"year": 2025, "round": 11, "race_name": "Austrian Grand Prix"},
    {"year": 2025, "round": 12, "race_name": "British Grand Prix"},
    {"year": 2025, "round": 13, "race_name": "Belgian Grand Prix"},
    {"year": 2025, "round": 14, "race_name": "Hungarian Grand Prix"},
    {"year": 2025, "round": 15, "race_name": "Dutch Grand Prix"},
    {"year": 2025, "round": 16, "race_name": "Italian Grand Prix"},
    {"year": 2025, "round": 17, "race_name": "Azerbaijan Grand Prix"},
    {"year": 2025, "round": 18, "race_name": "Singapore Grand Prix"},
    {"year": 2025, "round": 19, "race_name": "United States Grand Prix"},
    {"year": 2025, "round": 20, "race_name": "Mexico City Grand Prix"},
    {"year": 2025, "round": 21, "race_name": "São Paulo Grand Prix"},
    {"year": 2025, "round": 22, "race_name": "Las Vegas Grand Prix"},
    {"year": 2025, "round": 23, "race_name": "Qatar Grand Prix"},
    {"year": 2025, "round": 24, "race_name": "Abu Dhabi Grand Prix"},
]
# --- END: Supabase authoritative race list ---

def normalize_event_name(name):
    name = name.replace("_", " ")
    name_ascii = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode('ascii')
    return name_ascii.lower().strip()

race_lookup = {}
for race in supabase_races:
    key = (race["year"], normalize_event_name(race["race_name"]))
    race_lookup[key] = (race["race_name"], race["round"])

special_cases = {
    "sao paulo grand prix": "São Paulo Grand Prix",
    # Add more if needed
}

def cache_dir_to_supabase(year, cache_event_dir):
    match = re.match(r"\d{4}-\d{2}-\d{2}_(.+)", cache_event_dir)
    if not match:
        return None, None
    event_name = match.group(1).replace("_", " ")
    norm_name = normalize_event_name(event_name)
    if norm_name in special_cases:
        supabase_name = special_cases[norm_name]
        for race in supabase_races:
            if race["year"] == int(year) and race["race_name"] == supabase_name:
                return supabase_name, race["round"]
    result = race_lookup.get((int(year), norm_name))
    if result:
        return result
    return None, None

def get_race_id(year, round_number):
    resp = supabase.table('races').select('id').eq('year', year).eq('round', round_number).execute()
    if resp.data:
        return resp.data[0]['id']
    return None

def get_or_create_session(race_id, session_type, start_time):
    resp = supabase.table('sessions').select('id').eq('race_id', race_id).eq('type', session_type).execute()
    if resp.data:
        return resp.data[0]['id']
    data = {'race_id': race_id, 'type': session_type, 'start_time': start_time}
    resp = supabase.table('sessions').insert(data).execute()
    if resp.data:
        return resp.data[0]['id']
    return None

def load_laps_from_cache(session_path):
    # Try to find a laps parquet or feather file in the session_path
    for fname in os.listdir(session_path):
        if fname.startswith('laps') and (fname.endswith('.parquet') or fname.endswith('.feather')):
            fpath = os.path.join(session_path, fname)
            try:
                if fname.endswith('.parquet'):
                    return pd.read_parquet(fpath)
                else:
                    return pd.read_feather(fpath)
            except Exception as e:
                print(f"    Could not load laps from {fpath}: {e}")
    return None

def main():
    for year in sorted(os.listdir(CACHE_DIR)):
        year_path = os.path.join(CACHE_DIR, year)
        if not os.path.isdir(year_path):
            continue
        print(f"\n=== {year} ===")
        for event in sorted(os.listdir(year_path)):
            event_path = os.path.join(year_path, event)
            if not os.path.isdir(event_path):
                continue
            race_name, round_number = cache_dir_to_supabase(year, event)
            if not race_name or not round_number:
                print(f"  Could not map event to Supabase race: {event}")
                continue
            print(f"\n{race_name} (Round {round_number})")
            race_id = get_race_id(int(year), round_number)
            if not race_id:
                print(f"Race not found in Supabase: {year} R{round_number}")
                continue
            for session in sorted(os.listdir(event_path)):
                session_path = os.path.join(event_path, session)
                if not os.path.isdir(session_path):
                    continue
                # Guess session type from folder name
                session_type = None
                if 'Practice' in session:
                    session_type = f"Practice {session.split('_')[2]}" if 'Practice' in session else session
                elif 'Qualifying' in session:
                    session_type = 'Qualifying'
                elif 'Race' in session:
                    session_type = 'Race'
                else:
                    session_type = session
                # Try to load laps directly from cache
                laps_df = load_laps_from_cache(session_path)
                if laps_df is None or laps_df.empty:
                    print(f"  {session_type}... No lap data in cache")
                    continue
                # Insert session if not exists
                session_id = get_or_create_session(race_id, session_type, None)
                if not session_id:
                    print(f"Could not create/find session: {session_type}")
                    continue
                batch = []
                batch_size = 100
                for _, lap in laps_df.iterrows():
                    driver_code = lap.get('Driver') or lap.get('driver')
                    lap_number = int(lap.get('LapNumber') or lap.get('lap_number'))
                    lap_time = lap.get('LapTime') or lap.get('lap_time')
                    sector1 = lap.get('Sector1Time') or lap.get('sector1')
                    sector2 = lap.get('Sector2Time') or lap.get('sector2')
                    sector3 = lap.get('Sector3Time') or lap.get('sector3')
                    compound = lap.get('Compound') or lap.get('compound')
                    batch.append({
                        'session_id': session_id,
                        'driver_code': driver_code,
                        'lap_number': lap_number,
                        'lap_time': str(lap_time) if lap_time else None,
                        'sector1': str(sector1) if sector1 else None,
                        'sector2': str(sector2) if sector2 else None,
                        'sector3': str(sector3) if sector3 else None,
                        'compound': compound
                    })
                    if len(batch) >= batch_size:
                        supabase.table('laps').insert(batch).execute()
                        print(f"    Inserted {len(batch)} laps (batch)")
                        batch = []
                if batch:
                    supabase.table('laps').insert(batch).execute()
                    print(f"    Inserted {len(batch)} laps (final batch)")
                print(f"  {session_type}... OK")

if __name__ == "__main__":
    main() 