-- F1 Dashboard Unified Schema (Source of Truth)
-- Use this file to initialize or reset your Supabase database structure.

-------------------------------------------------------------------------------
-- 1. Seasons
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seasons (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL UNIQUE,
    season_name TEXT NOT NULL,
    total_races INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-------------------------------------------------------------------------------
-- 2. Races
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS races (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL REFERENCES seasons(year) ON DELETE CASCADE,
    round INTEGER NOT NULL,
    race_name TEXT NOT NULL,
    circuit_name TEXT NOT NULL,
    country TEXT NOT NULL,
    date DATE NOT NULL,
    fp1_date TIMESTAMP,
    fp2_date TIMESTAMP,
    fp3_date TIMESTAMP,
    qualifying_date TIMESTAMP,
    sprint_date TIMESTAMP,
    race_date TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(year, round)
);

-------------------------------------------------------------------------------
-- 3. Sessions (NEW: Explicit definition)
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    race_id INTEGER REFERENCES races(id) ON DELETE CASCADE,
    type TEXT NOT NULL,          -- e.g., 'Practice 1', 'Qualifying', 'Race'
    session_type TEXT,           -- Duplicate for script compatibility
    date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(race_id, type)
);

-------------------------------------------------------------------------------
-- 4. Drivers
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    driver_number TEXT NOT NULL, -- Stored as text in some scripts for flexibility
    driver_code TEXT NOT NULL,   -- e.g., 'VER', 'HAM'
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    team_name TEXT NOT NULL,
    country_code TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(year, driver_code)    -- Important: Changed from number to code for modern ETL scripts
);

-------------------------------------------------------------------------------
-- 5. Laps (Standardized: Unified 'laps' table)
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS laps (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    driver_code TEXT NOT NULL,
    lap_number INTEGER NOT NULL,
    lap_time TEXT,               -- Stored as string/duration
    sector1 TEXT,
    sector2 TEXT,
    sector3 TEXT,
    compound TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(session_id, driver_code, lap_number)
);

-------------------------------------------------------------------------------
-- 6. Telemetry (Modernized: Linked to laps)
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS telemetry (
    id SERIAL PRIMARY KEY,
    lap_id INTEGER REFERENCES laps(id) ON DELETE CASCADE,
    timestamp FLOAT,             -- Seconds since start of session or lap
    speed FLOAT,
    throttle FLOAT,
    brake FLOAT,
    gear INTEGER,
    rpm FLOAT,
    drs INTEGER,
    distance FLOAT,
    x FLOAT,
    y FLOAT,
    z FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-------------------------------------------------------------------------------
-- 7. Weather (Modernized: Linked to sessions)
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weather (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    air_temperature FLOAT,
    track_temperature FLOAT,
    humidity FLOAT,
    pressure FLOAT,
    wind_speed FLOAT,
    wind_direction FLOAT,
    rainfall FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(session_id)
);

-------------------------------------------------------------------------------
-- 8. Track Layouts (Coordinates for visualization)
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS track_layouts (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    round INTEGER NOT NULL,
    circuit_name TEXT NOT NULL,
    x_coords JSONB NOT NULL DEFAULT '[]',
    y_coords JSONB NOT NULL DEFAULT '[]',
    distances JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(year, round)
);

-------------------------------------------------------------------------------
-- 9. Legacy / Redundant (Optional, but kept for compatibility if needed)
-------------------------------------------------------------------------------
-- Note: lap_times table is deprecated in favor of 'laps'
-- race_results and driver_session_stats are currently unmanaged.

-------------------------------------------------------------------------------
-- 10. Indexes for Performance
-------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_seasons_year ON seasons(year);
CREATE INDEX IF NOT EXISTS idx_races_year_round ON races(year, round);
CREATE INDEX IF NOT EXISTS idx_sessions_race_id ON sessions(race_id);
CREATE INDEX IF NOT EXISTS idx_laps_session_id ON laps(session_id);
CREATE INDEX IF NOT EXISTS idx_laps_driver_code ON laps(driver_code);
CREATE INDEX IF NOT EXISTS idx_telemetry_lap_id ON telemetry(lap_id);
CREATE INDEX IF NOT EXISTS idx_weather_session_id ON weather(session_id);
CREATE INDEX IF NOT EXISTS idx_track_layouts_year_round ON track_layouts(year, round);

-- Comments
COMMENT ON TABLE seasons IS 'F1 seasons information';
COMMENT ON TABLE weather IS 'Weather conditions during F1 sessions';
COMMENT ON TABLE telemetry IS 'Car telemetry data (sampled) for analysis';
COMMENT ON TABLE laps IS 'Lap summaries for each driver and session';
COMMENT ON TABLE track_layouts IS 'X/Y coordinate data for circuit visualization';
