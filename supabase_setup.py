from supabase import create_client
from src.config import settings

supabase_url = settings.supabase_url
supabase_key = settings.supabase_key
supabase = create_client(supabase_url, supabase_key)
