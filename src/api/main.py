from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import fastf1
import os
import numpy as np
import json
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("f1-dash")

# Configure FastF1 cache
fastf1.Cache.enable_cache('fastf1_cache')

# Create FastAPI app
app = FastAPI(title="F1 Dash API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Team colors mapping for consistent UI
TEAM_COLORS = {
    "Red Bull Racing": "#0600EF",
    "Mercedes": "#00D2BE",
    "Ferrari": "#DC0000",
    "McLaren": "#FF8700",
    "Alpine": "#0090FF",
    "AlphaTauri": "#2B4562",
    "Aston Martin": "#006F62",
    "Williams": "#005AFF",
    "Alfa Romeo": "#900000",
    "Haas F1 Team": "#FFFFFF",
    "Racing Point": "#F596C8",
    "Renault": "#FFF500",
    "Toro Rosso": "#469BFF",
    "RB": "#6592ff",
    "Kick Sauber": "#52E252",
    "Visa RB": "#6592ff",
    "DEFAULT": "#888888"
}

def get_team_color(team_name):
    """Get the color for a specific team"""
    return TEAM_COLORS.get(team_name, TEAM_COLORS["DEFAULT"])

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Root endpoint to serve the frontend
@app.get("/", include_in_schema=False)
async def serve_frontend():
    return FileResponse("static/index.html")

# Include API routes
from .routes import router as api_router
app.include_router(api_router, prefix="/api")

# API endpoints
@app.get("/api/seasons")
async def get_seasons():
    """Get available seasons"""
    try:
        # Return seasons including 2024 and 2025
        return list(range(2018, 2026))
    except Exception as e:
        logger.error(f"Error getting seasons: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/races/{year}")
async def get_races(year: int):
    """Get races for a specific season"""
    try:
        schedule = fastf1.get_event_schedule(year)
        races = []
        for _, race in schedule.iterrows():
            races.append({
                "round": int(race['RoundNumber']),
                "name": race['EventName'],
                "circuit": race['Location'] if 'Location' in race else race['EventName'],
                "date": race['EventDate'].strftime("%Y-%m-%d")
            })
        return races
    except Exception as e:
        logger.error(f"Error getting races for year {year}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sessions/{year}/{round}")
async def get_sessions(year: int, round: int):
    """Get sessions for a specific race"""
    try:
        # Get the event 
        try:
            event = fastf1.get_event(year, round)
        except Exception as e:
            # If we can't get the event with fastf1.get_event, try an alternative approach
            schedule = fastf1.get_event_schedule(year)
            event_data = schedule[schedule['RoundNumber'] == round]
            if event_data.empty:
                raise HTTPException(status_code=404, detail=f"Event not found for year {year}, round {round}")
            
            # Return standard session names as fallback
            return ["Practice 1", "Practice 2", "Practice 3", "Qualifying", "Race"]
        
        # Get session names from the event
        sessions = []
        try:
            for session_name in event.get_session_names():
                sessions.append(session_name)
            
            # If no sessions were found, return standard sessions
            if not sessions:
                sessions = ["Practice 1", "Practice 2", "Practice 3", "Qualifying", "Race"]
        except Exception as e:
            # Fallback to standard session names
            sessions = ["Practice 1", "Practice 2", "Practice 3", "Qualifying", "Race"]
            
        return sessions
    except HTTPException:
        raise
    except Exception as e:
        # Return a more informative error message
        logger.error(f"Error getting sessions for year {year}, round {round}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting sessions: {str(e)}")

@app.get("/api/drivers/{year}/{round}/{session}")
async def get_drivers(year: int, round: int, session: str):
    """Get drivers for a specific session"""
    try:
        try:
            # Try to load the session data
            session_data = fastf1.get_session(year, round, session)
            session_data.load()
            
            # Get drivers from the session data
            drivers = []
            for driver in session_data.drivers:
                driver_info = session_data.get_driver(driver)
                team_name = driver_info['TeamName']
                drivers.append({
                    "code": driver,
                    "number": driver_info['DriverNumber'],
                    "name": f"{driver_info['FirstName']} {driver_info['LastName']}",
                    "team": team_name,
                    "color": get_team_color(team_name)
                })
            logger.info(f"Retrieved {len(drivers)} drivers for {year} {round} {session}")
            return drivers
            
        except Exception as e:
            logger.warning(f"Error loading drivers from session data: {str(e)}. Using dummy data.")
            # Fallback to dummy data if session loading fails
            # This provides a graceful degradation for development/demo purposes
            return [
                {"code": "VER", "number": "1", "name": "Max Verstappen", "team": "Red Bull Racing", "color": TEAM_COLORS["Red Bull Racing"]},
                {"code": "PER", "number": "11", "name": "Sergio Perez", "team": "Red Bull Racing", "color": TEAM_COLORS["Red Bull Racing"]},
                {"code": "HAM", "number": "44", "name": "Lewis Hamilton", "team": "Mercedes", "color": TEAM_COLORS["Mercedes"]},
                {"code": "RUS", "number": "63", "name": "George Russell", "team": "Mercedes", "color": TEAM_COLORS["Mercedes"]},
                {"code": "LEC", "number": "16", "name": "Charles Leclerc", "team": "Ferrari", "color": TEAM_COLORS["Ferrari"]},
                {"code": "SAI", "number": "55", "name": "Carlos Sainz", "team": "Ferrari", "color": TEAM_COLORS["Ferrari"]},
                {"code": "NOR", "number": "4", "name": "Lando Norris", "team": "McLaren", "color": TEAM_COLORS["McLaren"]},
                {"code": "PIA", "number": "81", "name": "Oscar Piastri", "team": "McLaren", "color": TEAM_COLORS["McLaren"]}
            ]
    except Exception as e:
        logger.error(f"Error getting drivers for {year} {round} {session}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/laps/{year}/{round}/{session}/{driver}")
async def get_laps(year: int, round: int, session: str, driver: str):
    """Get laps for a specific driver in a session"""
    try:
        try:
            # Try to load the session data
            session_data = fastf1.get_session(year, round, session)
            session_data.load()
            driver_laps = session_data.laps.pick_driver(driver)
            
            # Process the laps
            laps = []
            for _, lap in driver_laps.iterrows():
                lap_info = {
                    "lap": int(lap['LapNumber']),
                    "time": str(lap['LapTime']),
                }
                
                # Add optional fields if available
                if 'Sector1Time' in lap and lap['Sector1Time'] is not None:
                    lap_info["sector1"] = str(lap['Sector1Time'])
                if 'Sector2Time' in lap and lap['Sector2Time'] is not None:
                    lap_info["sector2"] = str(lap['Sector2Time'])
                if 'Sector3Time' in lap and lap['Sector3Time'] is not None:
                    lap_info["sector3"] = str(lap['Sector3Time'])
                if 'Compound' in lap and lap['Compound'] is not None:
                    lap_info["compound"] = lap['Compound']
                    
                laps.append(lap_info)
                
            logger.info(f"Retrieved {len(laps)} laps for driver {driver}")
            return laps
            
        except Exception as e:
            logger.warning(f"Error loading laps: {str(e)}. Using dummy data.")
            # Fallback to dummy data if session loading fails
            # This provides a graceful degradation for development/demo purposes
            return [
                {"lap": 1, "time": "1:30.123", "sector1": "24.123", "sector2": "31.456", "sector3": "34.544"},
                {"lap": 2, "time": "1:29.876", "sector1": "23.997", "sector2": "31.333", "sector3": "34.546"},
                {"lap": 3, "time": "1:29.543", "sector1": "23.881", "sector2": "31.228", "sector3": "34.434"},
                {"lap": 4, "time": "1:29.112", "sector1": "23.776", "sector2": "31.002", "sector3": "34.334"}
            ]
    except Exception as e:
        logger.error(f"Error getting laps for driver {driver}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/telemetry/{year}/{round}/{session}/{driver}/{lap}")
async def get_telemetry(year: int, round: int, session: str, driver: str, lap: int):
    """Get telemetry data for a specific lap"""
    try:
        try:
            # Try to load the session data
            session_data = fastf1.get_session(year, round, session)
            session_data.load()
            driver_laps = session_data.laps.pick_driver(driver)
            
            # Find the requested lap
            lap_data = driver_laps[driver_laps['LapNumber'] == lap]
            if lap_data.empty:
                raise ValueError(f"No data for lap {lap}")
                
            lap_data = lap_data.iloc[0]
            
            # Get driver info for color
            driver_info = session_data.get_driver(driver)
            team_name = driver_info['TeamName']
            team_color = get_team_color(team_name)
            
            # Get telemetry for this lap
            telemetry = session_data.get_car_data(driver).slice_by_lap(lap_data)
            
            # Convert to list of dictionaries for JSON serialization
            telemetry_data = []
            for i, row in telemetry.iterrows():
                data_point = {
                    "time": i.total_seconds(),
                    "speed": float(row['Speed']) if 'Speed' in row else 0,
                }
                
                # Add optional fields if available
                if 'RPM' in row:
                    data_point["rpm"] = float(row['RPM'])
                if 'nGear' in row:
                    data_point["gear"] = int(row['nGear'])
                if 'Throttle' in row:
                    data_point["throttle"] = float(row['Throttle'])
                if 'Brake' in row:
                    data_point["brake"] = float(row['Brake'])
                if 'DRS' in row:
                    data_point["drs"] = int(row['DRS'])
                    
                telemetry_data.append(data_point)
            
            logger.info(f"Retrieved telemetry data for driver {driver}, lap {lap} ({len(telemetry_data)} points)")
            return telemetry_data
            
        except Exception as e:
            logger.warning(f"Error loading telemetry: {str(e)}. Using dummy data.")
            # Generate dummy telemetry data for development/demo
            import math
            import random
            
            # Create time series from 0 to 90 seconds (typical lap time)
            times = [t/10 for t in range(901)]  # 0 to 90 seconds in 0.1s increments
            
            # Generate dummy data with some realistic patterns
            telemetry_data = []
            for t in times:
                # Speed varies between 80-320 km/h with some sinusoidal patterns
                speed = 160 + 120 * math.sin(t/10) + 40 * math.sin(t/2)
                
                # RPM roughly correlates with speed
                rpm = (speed / 320) * 12000 + 2000
                
                # Gear changes based on RPM thresholds
                gear = max(1, min(8, int(rpm / 1500)))
                
                # Throttle and brake are somewhat opposite (not perfect)
                throttle_full = max(0, min(100, 50 + 50 * math.sin(t/10 + 0.5)))
                brake_full = max(0, min(100, 20 - 20 * math.sin(t/10 + 0.5))) if throttle_full < 50 else 0
                
                # Scale to more realistic values
                throttle = throttle_full if throttle_full > 20 else 0
                brake = brake_full if throttle < 50 else 0
                
                # DRS randomly open on straights (high speed)
                drs = 1 if speed > 270 and random.random() > 0.7 else 0
                
                telemetry_data.append({
                    "time": t,
                    "speed": speed,
                    "rpm": rpm,
                    "gear": gear,
                    "throttle": throttle,
                    "brake": brake,
                    "drs": drs
                })
            
            return telemetry_data
    except Exception as e:
        logger.error(f"Error getting telemetry for driver {driver}, lap {lap}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/compare/{year}/{round}/{session}/{driver1}/{lap1}/{driver2}/{lap2}")
async def compare_telemetry(year: int, round: int, session: str, driver1: str, lap1: int, driver2: str, lap2: int):
    """Compare telemetry data between two drivers on specific laps"""
    try:
        logger.info(f"Comparing telemetry: year={year}, round={round}, session={session}, driver1={driver1}, lap1={lap1}, driver2={driver2}, lap2={lap2}")
        try:
            # Load session data
            session_data = fastf1.get_session(year, round, session)
            session_data.load()
            
            # Get telemetry for driver 1
            driver1_laps = session_data.laps.pick_driver(driver1)
            lap1_data = driver1_laps[driver1_laps['LapNumber'] == lap1]
            if lap1_data.empty:
                raise ValueError(f"No data for {driver1} lap {lap1}")
            lap1_data = lap1_data.iloc[0]
            telemetry1 = session_data.get_car_data(driver1).slice_by_lap(lap1_data)
            
            # Get telemetry for driver 2
            driver2_laps = session_data.laps.pick_driver(driver2)
            lap2_data = driver2_laps[driver2_laps['LapNumber'] == lap2]
            if lap2_data.empty:
                raise ValueError(f"No data for {driver2} lap {lap2}")
            lap2_data = lap2_data.iloc[0]
            telemetry2 = session_data.get_car_data(driver2).slice_by_lap(lap2_data)
            
            # Get driver colors
            driver1_info = session_data.get_driver(driver1)
            driver2_info = session_data.get_driver(driver2)
            driver1_team = driver1_info['TeamName']
            driver2_team = driver2_info['TeamName']
            
            # Get team colors
            driver1_color = get_team_color(driver1_team)
            driver2_color = get_team_color(driver2_team)
            
            logger.info(f"Team colors: {driver1_team}={driver1_color}, {driver2_team}={driver2_color}")
            
            # Process telemetry data
            driver1_data = {
                "time": [],
                "speed": [],
                "distance": [],
                "throttle": [],
                "brake": [],
                "gear": [],
                "rpm": [],
                "drs": []
            }
            
            driver2_data = {
                "time": [],
                "speed": [],
                "distance": [],
                "throttle": [],
                "brake": [],
                "gear": [],
                "rpm": [],
                "drs": []
            }
            
            # Extract telemetry metrics for driver 1
            for i, row in telemetry1.iterrows():
                driver1_data["time"].append(i.total_seconds())
                driver1_data["speed"].append(float(row['Speed']) if 'Speed' in row else 0)
                driver1_data["distance"].append(float(row['Distance']) if 'Distance' in row else 0)
                
                # Add optional fields if available
                if 'RPM' in row:
                    driver1_data["rpm"].append(float(row['RPM']))
                if 'nGear' in row:
                    driver1_data["gear"].append(int(row['nGear']))
                if 'Throttle' in row:
                    driver1_data["throttle"].append(float(row['Throttle']))
                if 'Brake' in row:
                    driver1_data["brake"].append(float(row['Brake']))
                if 'DRS' in row:
                    driver1_data["drs"].append(int(row['DRS']))
            
            # Extract telemetry metrics for driver 2
            for i, row in telemetry2.iterrows():
                driver2_data["time"].append(i.total_seconds())
                driver2_data["speed"].append(float(row['Speed']) if 'Speed' in row else 0)
                driver2_data["distance"].append(float(row['Distance']) if 'Distance' in row else 0)
                
                # Add optional fields if available
                if 'RPM' in row:
                    driver2_data["rpm"].append(float(row['RPM']))
                if 'nGear' in row:
                    driver2_data["gear"].append(int(row['nGear']))
                if 'Throttle' in row:
                    driver2_data["throttle"].append(float(row['Throttle']))
                if 'Brake' in row:
                    driver2_data["brake"].append(float(row['Brake']))
                if 'DRS' in row:
                    driver2_data["drs"].append(int(row['DRS']))
            
            # Calculate deltas
            try:
                delta_time = float(lap1_data["LapTime"].total_seconds() - lap2_data["LapTime"].total_seconds())
            except:
                delta_time = 0
                
            try:
                delta_s1 = float(lap1_data["Sector1Time"].total_seconds() - lap2_data["Sector1Time"].total_seconds()) if "Sector1Time" in lap1_data and "Sector1Time" in lap2_data else 0
            except:
                delta_s1 = 0
                
            try:
                delta_s2 = float(lap1_data["Sector2Time"].total_seconds() - lap2_data["Sector2Time"].total_seconds()) if "Sector2Time" in lap1_data and "Sector2Time" in lap2_data else 0
            except:
                delta_s2 = 0
                
            try:
                delta_s3 = float(lap1_data["Sector3Time"].total_seconds() - lap2_data["Sector3Time"].total_seconds()) if "Sector3Time" in lap1_data and "Sector3Time" in lap2_data else 0
            except:
                delta_s3 = 0
            
            delta = {
                "time": delta_time,
                "sector1": delta_s1,
                "sector2": delta_s2,
                "sector3": delta_s3
            }
            
            logger.info(f"Comparison deltas: time={delta_time}, s1={delta_s1}, s2={delta_s2}, s3={delta_s3}")
            
            # Ensure we have lap times as strings
            lap1_time_str = str(lap1_data["LapTime"]) if "LapTime" in lap1_data else "N/A"
            lap2_time_str = str(lap2_data["LapTime"]) if "LapTime" in lap2_data else "N/A"
            
            return {
                "driver1": {
                    "code": driver1,
                    "team": driver1_team,
                    "color": driver1_color,
                    "lap": int(lap1),
                    "lapTime": lap1_time_str,
                    "data": driver1_data
                },
                "driver2": {
                    "code": driver2,
                    "team": driver2_team,
                    "color": driver2_color,
                    "lap": int(lap2),
                    "lapTime": lap2_time_str,
                    "data": driver2_data
                },
                "delta": delta
            }
            
        except Exception as e:
            logger.warning(f"Error in compare telemetry: {str(e)}. Using dummy data.")
            # Generate dummy comparison data for development/demo
            import math
            import random
            
            # Create time series from 0 to 90 seconds (typical lap time)
            times = [t/10 for t in range(901)]  # 0 to 90 seconds in 0.1s increments
            
            # Get team colors from our mapping
            driver1_color = get_team_color("Red Bull Racing") 
            driver2_color = get_team_color("Ferrari")
            
            # Generate dummy driver data
            driver1_data = {
                "time": times,
                "speed": [160 + 120 * math.sin(t/10) + 40 * math.sin(t/2) for t in times],
                "distance": [t * 5 for t in times],  # Approx 450m per second at F1 speeds
                "throttle": [max(0, min(100, 50 + 50 * math.sin(t/10 + 0.5))) for t in times],
                "brake": [max(0, min(100, 20 - 20 * math.sin(t/10 + 0.5))) for t in times],
                "gear": [max(1, min(8, int((160 + 120 * math.sin(t/10) + 40 * math.sin(t/2)) / 40))) for t in times],
                "rpm": [(160 + 120 * math.sin(t/10) + 40 * math.sin(t/2)) * 35 + 2000 for t in times],
                "drs": [1 if (160 + 120 * math.sin(t/10) + 40 * math.sin(t/2)) > 270 and random.random() > 0.7 else 0 for t in times]
            }
            
            # Second driver slightly different pattern
            driver2_data = {
                "time": times,
                "speed": [155 + 125 * math.sin(t/10 + 0.2) + 35 * math.sin(t/2 + 0.1) for t in times],
                "distance": [t * 4.95 for t in times],
                "throttle": [max(0, min(100, 48 + 52 * math.sin(t/10 + 0.6))) for t in times],
                "brake": [max(0, min(100, 22 - 22 * math.sin(t/10 + 0.6))) for t in times],
                "gear": [max(1, min(8, int((155 + 125 * math.sin(t/10 + 0.2) + 35 * math.sin(t/2 + 0.1)) / 40))) for t in times],
                "rpm": [(155 + 125 * math.sin(t/10 + 0.2) + 35 * math.sin(t/2 + 0.1)) * 35 + 2000 for t in times],
                "drs": [1 if (155 + 125 * math.sin(t/10 + 0.2) + 35 * math.sin(t/2 + 0.1)) > 270 and random.random() > 0.7 else 0 for t in times]
            }
            
            # Return dummy comparison data
            return {
                "driver1": {
                    "code": driver1,
                    "team": "Red Bull Racing",
                    "color": driver1_color,
                    "lap": lap1,
                    "lapTime": "1:29.324",
                    "data": driver1_data
                },
                "driver2": {
                    "code": driver2,
                    "team": "Ferrari",
                    "color": driver2_color,
                    "lap": lap2,
                    "lapTime": "1:29.831",
                    "data": driver2_data
                },
                "delta": {
                    "time": -0.507,  # Negative means driver1 is faster
                    "sector1": -0.122,
                    "sector2": -0.285,
                    "sector3": -0.100
                }
            }
    except Exception as e:
        logger.error(f"Error in compare_telemetry: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/track/{year}/{round}")
async def get_track_data(year: int, round: int):
    """Get track data with sector information"""
    try:
        logger.info(f"Getting track data for year={year}, round={round}")
        try:
            # Load session data (using qualifying for track layout)
            session_data = fastf1.get_session(year, round, 'Q')
            session_data.load()
            
            # Get track info and circuit name
            weekend = session_data.event
            circuit_name = weekend.Circuit.name if hasattr(weekend, 'Circuit') and hasattr(weekend.Circuit, 'name') else f"Circuit {round}"
            
            # Get track map coordinates
            try:
                # Get x and y coordinates
                x_coordinates = []
                y_coordinates = []
                
                # Try different methods to get track coordinates
                if hasattr(session_data, 'get_track_status_data'):
                    track_map = session_data.get_track_status_data()
                    if hasattr(track_map, 'x') and hasattr(track_map, 'y'):
                        x_coordinates = track_map.x.tolist()
                        y_coordinates = track_map.y.tolist()
                
                # If we still don't have coordinates, try to get them from circuit info
                if not x_coordinates and hasattr(session_data, 'get_circuit_info'):
                    circuit_info = session_data.get_circuit_info()
                    if hasattr(circuit_info, 'layout'):
                        layout = circuit_info.layout
                        if len(layout) > 0:
                            for point in layout:
                                x_coordinates.append(point[0])
                                y_coordinates.append(point[1])
                
                # If we still have no coordinates, try to get them from the fastest lap
                if not x_coordinates:
                    try:
                        fastest_lap = session_data.laps.pick_fastest()
                        pos_data = fastest_lap.get_pos_data()
                        x_coordinates = pos_data['X'].tolist()
                        y_coordinates = pos_data['Y'].tolist()
                    except:
                        pass
                
                # Get sector boundaries
                sector_boundaries = []
                for i in range(1, 3):  # Get boundaries for sectors 1 and 2 (sector 3 ends at finish line)
                    try:
                        if hasattr(session_data.laps, 'pick_fastest'):
                            fastest_lap = session_data.laps.pick_fastest()
                            car_data = fastest_lap.get_car_data()
                            
                            # Find the point where sector time is reached
                            sector_time_col = f'Sector{i}Time'
                            if sector_time_col in fastest_lap and fastest_lap[sector_time_col] is not None:
                                # Convert sector time to session time
                                sector_session_time = fastest_lap['LapStartTime'] + fastest_lap[sector_time_col]
                                
                                # Find closest point in telemetry
                                closest_idx = (car_data.index - sector_session_time).abs().idxmin()
                                closest_data = car_data.loc[closest_idx]
                                
                                if 'X' in closest_data and 'Y' in closest_data:
                                    boundary = {
                                        "sector": i,
                                        "x": float(closest_data['X']),
                                        "y": float(closest_data['Y'])
                                    }
                                    sector_boundaries.append(boundary)
                    except Exception as sector_error:
                        logger.warning(f"Could not get sector {i} boundary: {sector_error}")
                
                # If we couldn't get sector boundaries, approximate them
                if not sector_boundaries and x_coordinates:
                    logger.info("Using approximate sector boundaries")
                    # Approximate sector boundaries at 1/3 and 2/3 of the track length
                    track_length = len(x_coordinates)
                    sector_boundaries = [
                        {
                            "sector": 1,
                            "x": x_coordinates[track_length // 3],
                            "y": y_coordinates[track_length // 3]
                        },
                        {
                            "sector": 2,
                            "x": x_coordinates[2 * track_length // 3],
                            "y": y_coordinates[2 * track_length // 3]
                        }
                    ]
                
                logger.info(f"Retrieved track data for {circuit_name} with {len(x_coordinates)} points and {len(sector_boundaries)} sector boundaries")
                
                return {
                    "circuit_name": circuit_name,
                    "coordinates": {
                        "x": x_coordinates,
                        "y": y_coordinates
                    },
                    "sector_boundaries": sector_boundaries
                }
            except Exception as e:
                logger.warning(f"Could not get track coordinates: {str(e)}")
                # If we couldn't get track map, use dummy data
                raise e
                
        except Exception as e:
            logger.warning(f"Error getting track data: {str(e)}. Using dummy data.")
            # Generate dummy track data for development/demo
            import math
            
            # Create oval-like track shape using parametric equations
            t_values = [t * math.pi / 180 for t in range(0, 360, 2)]  # 0 to 360 degrees in 2-degree steps
            
            # Calculate x and y coordinates for oval track
            a, b = 1000, 500  # Semi-major and semi-minor axes
            x_coordinates = [a * math.cos(t) + (100 * math.sin(2*t)) for t in t_values]
            y_coordinates = [b * math.sin(t) + (50 * math.sin(3*t)) for t in t_values]
            
            # Approximate sector boundaries at 1/3 and 2/3 of the track length
            sector1_idx = len(t_values) // 3
            sector2_idx = 2 * len(t_values) // 3
            
            logger.info(f"Generated dummy track data with {len(x_coordinates)} points")
            
            return {
                "circuit_name": f"Circuit {round} ({year})",
                "coordinates": {
                    "x": x_coordinates,
                    "y": y_coordinates
                },
                "sector_boundaries": [
                    {
                        "sector": 1,
                        "x": x_coordinates[sector1_idx],
                        "y": y_coordinates[sector1_idx]
                    },
                    {
                        "sector": 2,
                        "x": x_coordinates[sector2_idx],
                        "y": y_coordinates[sector2_idx]
                    }
                ]
            }
    except Exception as e:
        logger.error(f"Error in get_track_data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 