"""Quick check of data population status in Supabase."""
import sys
sys.path.insert(0, '.')
from supabase_setup import supabase

YEARS = [2020, 2021, 2022, 2023, 2024, 2025]

def count_by_year(table, year_col='year'):
    """Get count for each year."""
    counts = {}
    for year in YEARS:
        res = supabase.table(table).select('id', count='exact').eq(year_col, year).execute()
        counts[year] = res.count or 0
    return counts

def main():
    print("=" * 60)
    print("SUPABASE DATA STATUS")
    print("=" * 60)
    
    tables = ['races', 'drivers', 'track_layouts']
    
    for table in tables:
        print(f"\n{table.upper()}")
        counts = count_by_year(table)
        for year, count in counts.items():
            status = "OK" if count > 0 else "--"
            print(f"  {year}: {count:>4} {status}")
        print(f"  Total: {sum(counts.values())}")
    
    # Weather (different schema)
    print(f"\nWEATHER")
    total_weather = supabase.table('weather').select('id', count='exact').execute().count or 0
    print(f"  Total: {total_weather}")
    
    # Sessions (need to join via races)
    print(f"\nSESSIONS")
    total_sessions = supabase.table('sessions').select('id', count='exact').execute().count or 0
    print(f"  Total: {total_sessions}")
    
    # Laps
    print(f"\nLAPS")
    total_laps = supabase.table('laps').select('id', count='exact').execute().count or 0
    print(f"  Total: {total_laps}")
    
    # Telemetry
    print(f"\nTELEMETRY")
    total_tel = supabase.table('telemetry').select('id', count='exact').execute().count or 0
    print(f"  Total: {total_tel}")
    
    print("\n" + "=" * 60)

if __name__ == '__main__':
    main()

