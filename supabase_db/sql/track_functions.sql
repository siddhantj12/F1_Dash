SET search_path = public;

-------------------------------------------------------------------------------
-- Track layouts table to cache circuit coordinates.
-- One row per race stores the X/Y/Distance arrays from a representative lap.
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

CREATE INDEX IF NOT EXISTS idx_track_layouts_year_round ON track_layouts(year, round);

-------------------------------------------------------------------------------
-- Get track layout for a specific race.
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_track_layout(
    p_year integer,
    p_round integer
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT jsonb_build_object(
        'circuit_name', t.circuit_name,
        'coordinates', jsonb_build_object(
            'x', t.x_coords,
            'y', t.y_coords,
            'distance', t.distances
        ),
        'sector_boundaries', '[]'::jsonb
    )
    FROM track_layouts t
    WHERE t.year = p_year
      AND t.round = p_round
    LIMIT 1;
$$;

