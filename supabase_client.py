import os
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get Supabase credentials from environment variables
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials. Please check your .env file.")

# Create Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Example usage
if __name__ == "__main__":
    try:
        # Test connection by fetching data from a table (e.g., 'seasons')
        response = supabase.table("seasons").select("*").execute()
        print("Connection successful!")
        print(response.data)
    except Exception as e:
        print(f"Connection failed: {str(e)}") 