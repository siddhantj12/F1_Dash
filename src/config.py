from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    fastf1_cache_dir: str = "fastf1_cache"
    api_cache_ttl: int = 3600  # 1 hour
    default_year: int = 2026

    supabase_url: str = ""
    supabase_key: str = ""

    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0

    # Auth0
    auth0_domain: str = ""
    auth0_audience: str = ""
    auth0_client_id: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
