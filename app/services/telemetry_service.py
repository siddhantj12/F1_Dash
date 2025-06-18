from fastf1.core import Session
from ..models import TelemetryData, TelemetryResponse
import numpy as np
import pandas as pd
from ..cache import cache

class TelemetryService:
    def __init__(self):
        self.current_session: Session = None
        
    async def process_telemetry(self, telemetry_data, session_data, driver):
        """Process telemetry data with enhanced features"""
        def clean_series(series):
            return series.fillna(0).replace([np.inf, -np.inf], 0).astype(float).tolist()
            
        # Normalize track coordinates
        x_min, x_max = telemetry_data['X'].min(), telemetry_data['X'].max()
        y_min, y_max = telemetry_data['Y'].min(), telemetry_data['Y'].max()
        
        telemetry_data['X_norm'] = (telemetry_data['X'] - x_min) / (x_max - x_min)
        telemetry_data['Y_norm'] = (telemetry_data['Y'] - y_min) / (y_max - y_min)
        
        # Calculate lap percentage
        max_distance = float(telemetry_data['Distance'].fillna(0).max() or 1)
        lap_percentage = clean_series((telemetry_data['Distance'] / max_distance * 100))
        
        return TelemetryData(
            lap_percentage=lap_percentage,
            speed=clean_series(telemetry_data['Speed']),
            throttle=clean_series(telemetry_data['Throttle']),
            brake=clean_series(telemetry_data['Brake']),
            x=clean_series(telemetry_data['X_norm']),
            y=clean_series(telemetry_data['Y_norm'])
        )
        
    async def update_live_positions(self, session_data):
        """Update live position data in cache"""
        positions = []
        
        for driver in session_data.drivers:
            last_lap = session_data.laps.pick_driver(driver).iloc[-1]
            position_data = {
                "position": int(last_lap['Position']),
                "driver": driver,
                "gap": float(last_lap['Gap']) if pd.notna(last_lap['Gap']) else None,
                "sector_times": {
                    i: float(last_lap[f'Sector{i}Time'].total_seconds())
                    if pd.notna(last_lap[f'Sector{i}Time']) else None
                    for i in range(1, 4)
                }
            }
            positions.append(position_data)
            
        await cache.set("latest_positions", positions, ttl=15)  # 15 seconds TTL

telemetry_service = TelemetryService()