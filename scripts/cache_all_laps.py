import fastf1
from fastf1 import events

# Only cache laps for 2022–2025
YEARS = range(2022, 2026)
SESSION_TYPES = [
    'Practice 1', 'Practice 2', 'Practice 3',
    'Sprint Shootout', 'Sprint',
    'Qualifying', 'Race'
]

fastf1.Cache.enable_cache('cache')

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
                session = fastf1.get_session(year, round_number, session_type)
                session.load(laps=True, telemetry=False, weather=False)
                print(f"  {session_type}... OK")
            except Exception as e:
                print(f"  {session_type}... Not available or error: {e}") 