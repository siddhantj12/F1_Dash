from pydantic import BaseModel

class Settings(BaseModel):
    fastf1_cache_dir: str = "fastf1_cache"
    api_cache_ttl: int = 3600  # 1 hour
    default_year: int = 2024
    
    # Team colors and other constants from your current code
    team_colors: dict = {
        2024: {
            'HAM': '#6CD3BF', 'RUS': '#6CD3BF',  # Mercedes
            'VER': '#3671C6', 'PER': '#3671C6',  # Red Bull
            # ... (rest of your team colors)
        }
    }