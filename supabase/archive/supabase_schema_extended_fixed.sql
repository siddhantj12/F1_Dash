-- Extended schema for F1 Dashboard (Fixed Version)
-- Additional tables for seasons, weather, and telemetry data

-- Create seasons table
CREATE TABLE IF NOT EXISTS seasons (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL UNIQUE,
    season_name TEXT NOT NULL,
    total_races INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create weather table
CREATE TABLE IF NOT EXISTS weather (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    round INTEGER NOT NULL,
    session TEXT NOT NULL,
    event_name TEXT NOT NULL,
    air_temperature FLOAT,
    track_temperature FLOAT,
    humidity FLOAT,
    pressure FLOAT,
    wind_speed FLOAT,
    wind_direction FLOAT,
    rainfall FLOAT,
    session_start TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(year, round, session)
    -- Note: Removed foreign key constraint to avoid issues with existing data
);

-- Create telemetry table
CREATE TABLE IF NOT EXISTS telemetry (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    round INTEGER NOT NULL,
    driver_number INTEGER NOT NULL,
    event_name TEXT NOT NULL,
    session TEXT NOT NULL,
    timestamp TIMESTAMP,
    lap_number INTEGER,
    sector INTEGER,
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
    -- Note: Removed foreign key constraints to avoid issues with existing data
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_seasons_year ON seasons(year);
CREATE INDEX IF NOT EXISTS idx_weather_year_round ON weather(year, round);
CREATE INDEX IF NOT EXISTS idx_weather_session ON weather(session);
CREATE INDEX IF NOT EXISTS idx_telemetry_year_round ON telemetry(year, round);
CREATE INDEX IF NOT EXISTS idx_telemetry_driver ON telemetry(year, driver_number);
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry(timestamp);
CREATE INDEX IF NOT EXISTS idx_telemetry_lap ON telemetry(year, round, lap_number);

-- Add comments for documentation
COMMENT ON TABLE seasons IS 'F1 seasons information';
COMMENT ON TABLE weather IS 'Weather conditions during F1 sessions';
COMMENT ON TABLE telemetry IS 'Car telemetry data (sampled) for analysis';

-- Optional: Add foreign key constraints after data is loaded (if needed)
-- ALTER TABLE weather ADD CONSTRAINT fk_weather_races 
--     FOREIGN KEY (year, round) REFERENCES races(year, round);
-- ALTER TABLE telemetry ADD CONSTRAINT fk_telemetry_races 
--     FOREIGN KEY (year, round) REFERENCES races(year, round);
-- ALTER TABLE telemetry ADD CONSTRAINT fk_telemetry_drivers 
--     FOREIGN KEY (year, driver_number) REFERENCES drivers(year, driver_number); 