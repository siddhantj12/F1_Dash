from pydantic import BaseModel
from typing import List, Dict, Optional, Any, Union

class TelemetryResponse(BaseModel):
    """Response model for telemetry data"""
    time: List[float]
    speed: List[float]
    rpm: Optional[List[float]] = None
    gear: Optional[List[int]] = None
    throttle: Optional[List[float]] = None
    brake: Optional[List[float]] = None
    drs: Optional[List[int]] = None

class LapResponse(BaseModel):
    """Response model for lap data"""
    lap: int
    time: str
    sector1: Optional[str] = None
    sector2: Optional[str] = None
    sector3: Optional[str] = None
    compound: Optional[str] = None

class DriverResponse(BaseModel):
    """Response model for driver data"""
    code: str
    number: str
    name: str
    team: str

class RaceResponse(BaseModel):
    """Response model for race data"""
    round: int
    name: str
    circuit: str
    date: str

class SessionResponse(BaseModel):
    """Response model for session data"""
    name: str

class ComparisonResponse(BaseModel):
    """Response model for comparison data"""
    driver1: Dict[str, List[float]]
    driver2: Dict[str, List[float]]
    delta: Dict[str, List[float]]

class TireResponse(BaseModel):
    """Response model for tire data"""
    compound: str
    laps: int
    performance: float

class PositionResponse(BaseModel):
    """Response model for position data"""
    driver: str
    position: int
    lap: int

class AuthResponse(BaseModel):
    """Response model for authentication"""
    access_token: str
    token_type: str = "bearer" 