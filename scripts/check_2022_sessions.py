"""Check if sessions exist for 2022 races R9-R22."""
import sys
sys.path.insert(0, '.')
import fastf1
from supabase_setup import supabase

fastf1.Cache.enable_cache('fastf1_cache')

schedule = fastf1.get_event_schedule(2022)
races = schedule[schedule['RoundNumber'] > 0]

print("Checking all 2022 races for sessions:\n")

for _, race in races.iterrows():
    round_num = race['RoundNumber']
    
    event_name = race['EventName']
    
    # Check if race exists
    res = supabase.table('races').select('id').eq('year', 2022).eq('round', round_num).limit(1).execute()
    if not res.data:
        print(f"R{round_num} {event_name}: NO RACE IN DB")
        continue
    
    race_id = res.data[0]['id']
    
    # Check sessions
    res = supabase.table('sessions').select('id', count='exact').eq('race_id', race_id).execute()
    session_count = res.count or 0
    
    print(f"R{round_num} {event_name}: {session_count} sessions")

