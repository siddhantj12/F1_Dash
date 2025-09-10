from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    fastf1_cache_dir: str = "fastf1_cache"
    api_cache_ttl: int = 3600  # 1 hour
    default_year: int = 2024

    supabase_url: str
    supabase_key: str

    token_url: str = "/api/token"

    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0

    class Config:
        env_file = ".env"

settings = Settings()
