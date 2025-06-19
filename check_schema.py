import sys
import os
from supabase_client import supabase

def check_table_structure():
    """
    Check the structure of existing tables in Supabase
    """
    try:
        # Check races table
        print("=== RACES TABLE ===")
        result = supabase.table('races').select('*').limit(1).execute()
        if result.data:
            print("Columns:", list(result.data[0].keys()))
        else:
            print("No data in races table")
        
        print("\n=== DRIVERS TABLE ===")
        result = supabase.table('drivers').select('*').limit(1).execute()
        if result.data:
            print("Columns:", list(result.data[0].keys()))
        else:
            print("No data in drivers table")
        
        print("\n=== LAP_TIMES TABLE ===")
        result = supabase.table('lap_times').select('*').limit(1).execute()
        if result.data:
            print("Columns:", list(result.data[0].keys()))
        else:
            print("No data in lap_times table")
            
    except Exception as e:
        print(f"Error checking table structure: {str(e)}")

if __name__ == "__main__":
    check_table_structure() 