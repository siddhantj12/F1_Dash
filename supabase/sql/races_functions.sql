SET search_path = public;

-------------------------------------------------------------------------------
-- Get all available seasons from the seasons table.
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_seasons()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        jsonb_agg(s.year ORDER BY s.year DESC),
        '[]'::jsonb
    )
    FROM seasons s;
$$;

-------------------------------------------------------------------------------
-- Get all races for a given season.
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_races(p_year integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'round', r.round,
                'name', r.race_name,
                'circuit', r.circuit_name,
                'date', to_char(r.date, 'YYYY-MM-DD')
            )
            ORDER BY r.round
        ),
        '[]'::jsonb
    )
    FROM races r
    WHERE r.year = p_year;
$$;

-------------------------------------------------------------------------------
-- Get available sessions for a specific race.
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_sessions(p_year integer, p_round integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        jsonb_agg(
            COALESCE(s.session_type, s.type)
            ORDER BY s.id
        ),
        '[]'::jsonb
    )
    FROM sessions s
    JOIN races r ON r.id = s.race_id
    WHERE r.year = p_year
      AND r.round = p_round;
$$;

