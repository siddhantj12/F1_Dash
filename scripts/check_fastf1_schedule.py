import fastf1
from fastf1 import events

def check_schedule(year):
    try:
        schedule = events.get_event_schedule(year)
        if not schedule.empty:
            print(f"✅ Schedule for {year} is AVAILABLE! {len(schedule)} events found.")
        else:
            print(f"⚠️ Schedule for {year} is EMPTY.")
    except Exception as e:
        print(f"❌ Could not get event schedule for {year}: {e}")

if __name__ == "__main__":
    for year in range(2022, 2026):
        check_schedule(year) 