import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

try:
    # Get one row to see all keys
    res = supabase.table("telemetry").select("*").limit(1).execute()
    if res.data:
        print("Columns in telemetry:", res.data[0].keys())
    else:
        print("Telemetry table is empty.")
except Exception as e:
    print(f"Error checking columns: {e}")
