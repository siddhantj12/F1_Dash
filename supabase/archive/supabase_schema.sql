-- Create races table
CREATE TABLE IF NOT EXISTS races (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
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

-- Create drivers table
CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    driver_number INTEGER NOT NULL,
    driver_code TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    team_name TEXT NOT NULL,
    country_code TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(year, driver_number)
);

-- Create lap_times table
CREATE TABLE IF NOT EXISTS lap_times (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    round INTEGER NOT NULL,
    driver_number INTEGER NOT NULL,
    lap_number INTEGER NOT NULL,
    lap_time FLOAT,
    sector1_time FLOAT,
    sector2_time FLOAT,
    sector3_time FLOAT,
    compound TEXT,
    tyre_life INTEGER,
    position INTEGER,
    track_status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(year, round, driver_number, lap_number),
    FOREIGN KEY (year, round) REFERENCES races(year, round),
    FOREIGN KEY (year, driver_number) REFERENCES drivers(year, driver_number)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_races_year_round ON races(year, round);
CREATE INDEX IF NOT EXISTS idx_drivers_year_number ON drivers(year, driver_number);
CREATE INDEX IF NOT EXISTS idx_lap_times_year_round ON lap_times(year, round);
CREATE INDEX IF NOT EXISTS idx_lap_times_driver ON lap_times(year, driver_number); 