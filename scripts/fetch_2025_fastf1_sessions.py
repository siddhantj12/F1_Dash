import fastf1
from fastf1 import events
from fastf1.utils import SessionNotAvailableError

# List of all possible session types
SESSION_TYPES = [
    'Practice 1', 'Practice 2', 'Practice 3',
    'Sprint Shootout', 'Sprint',
    'Qualifying', 'Race'
]

def fetch_2025_sessions():
    year = 2025
    event_schedule = events.get_event_schedule(year)
    for idx, event in event_schedule.iterrows():
        round_number = event['RoundNumber']
        event_name = event['EventName']
        print(f"\nFetching sessions for {event_name} (Round {round_number})...")
        for session_type in SESSION_TYPES:
            try:
                print(f"  - {session_type}...", end=" ")
                session = fastf1.get_session(year, round_number, session_type)
                session.load()  # This will cache the session data
                print("OK")
            except SessionNotAvailableError:
                print("Not available")
            except Exception as e:
                print(f"Error: {e}")

if __name__ == "__main__":
    fetch_2025_sessions() 