import fastf1
from fastf1 import events

YEARS = range(2020, 2026)
SESSION_TYPES = [
    'Practice 1', 'Practice 2', 'Practice 3',
    'Sprint Shootout', 'Sprint',
    'Qualifying', 'Race'
]

def fetch_all_telemetry():
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
                    drivers = session.drivers
                    for drv in drivers:
                        drv_code = session.get_driver(drv)['Abbreviation']
                        print(f"    Telemetry for {drv_code}...", end=" ")
                        try:
                            tel = session.laps.pick_driver(drv_code).get_car_data()
                            # This will trigger telemetry download and caching
                            print("OK")
                        except Exception as e:
                            print(f"No telemetry: {e}")
                except Exception as e:
                    print(f"Not available or error: {e}")

if __name__ == "__main__":
    fetch_all_telemetry() 