from supabase import create_client
from src.config import settings

supabase_url = settings.supabase_url
supabase_key = settings.supabase_key

# Validate Supabase credentials before creating the client
def _is_invalid_cred(val, default_markers):
    return (
        val is None
        or not str(val).strip()
        or str(val).strip() in default_markers
    )

_default_url_markers = {"your-supabase-url", "https://xyzcompany.supabase.co"}
_default_key_markers = {"your-supabase-key", "public-anon-key"}

if _is_invalid_cred(supabase_url, _default_url_markers):
    raise ValueError("Supabase URL is not set or is using a default/placeholder value.")
if _is_invalid_cred(supabase_key, _default_key_markers):
    raise ValueError("Supabase Key is not set or is using a default/placeholder value.")
supabase = create_client(supabase_url, supabase_key)
