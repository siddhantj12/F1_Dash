import sys
import os
import random
import fastf1
import pandas as pd
from datetime import datetime
from supabase_setup import supabase

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configuration
fastf1.Cache.enable_cache('fastf1_cache')

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def audit_race(year, round_num):
    log(f"AUDITING Year {year}, Round {round_num}...")
    
    try:
        # 1. Load from FastF1
        ff1_session = fastf1.get_session(year, round_num, 'Race')
        ff1_session.load(laps=True, telemetry=False, weather=True)
        ff1_laps = ff1_session.laps
        
        # 2. Load from Supabase
        race_res = supabase.table('races').select('id').eq('year', year).eq('round', round_num).limit(1).execute()
        if not race_res.data:
            log("❌ Race not found in Supabase")
            return
        race_id = race_res.data[0]['id']
        
        session_res = supabase.table('sessions').select('id').eq('race_id', race_id).eq('type', 'Race').limit(1).execute()
        if not session_res.data:
            log("❌ Session (Race) not found in Supabase")
            return
        session_id = session_res.data[0]['id']
        
        # Fetch ALL laps (handling pagination if needed, but here we just want the count)
        # Use count='exact' to get the real total from the DB without fetching all rows
        count_res = supabase.table('laps').select('id', count='exact').eq('session_id', session_id).execute()
        db_count = count_res.count
        
        # 3. COMPARE LAPS
        log(f"--- LAPS ---")
        log(f"FastF1 count: {len(ff1_laps)}")
        log(f"Supabase count: {db_count}")
        
        if len(ff1_laps) == db_count:
            log("✅ Lap counts match!")
        else:
            log(f"⚠️ Lap counts MISMATCH! Diff: {abs(len(ff1_laps) - db_count)}")
            
            # Find which drivers are missing or have fewer laps
            db_laps_summary = supabase.table('laps').select('driver_code, lap_number').eq('session_id', session_id).execute().data
            df_db = pd.DataFrame(db_laps_summary)
            if not df_db.empty:
                for driver in ff1_laps['Driver'].unique():
                    ff1_driver_laps = len(ff1_laps[ff1_laps['Driver'] == driver])
                    db_driver_laps = len(df_db[df_db['driver_code'] == driver])
                    if ff1_driver_laps != db_driver_laps:
                        log(f"  ❌ Driver {driver}: FF1={ff1_driver_laps}, DB={db_driver_laps}")

    except Exception as e:
        log(f"❌ Audit failed with error: {e}")

if __name__ == "__main__":
    # Audit 2023 Round 1 (Bahrain) as it was just populated
    audit_race(2023, 1)
    print("\n" + "="*40 + "\n")
    # Audit a random race from 2022 to check older data
    audit_race(2022, random.randint(1, 22))
