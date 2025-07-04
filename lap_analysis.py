import os
import fastf1

class F1LapAnalyzer:
    def __init__(self):
        """Initialize the F1 Lap Analyzer."""
        # Create cache directory if it doesn't exist
        cache_dir = 'f1_cache'
        if not os.path.exists(cache_dir):
            os.makedirs(cache_dir)
        
        # Enable cache
        fastf1.Cache.enable_cache(cache_dir)
        # Rest of your initialization code...