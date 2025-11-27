SET search_path = public;

-------------------------------------------------------------------------------
-- Get tire stint changes for a driver in a session.
-- Returns array of {lap, compound} objects where compound changed.
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_tire_history(
    p_year integer,
    p_round integer,
    p_session text,
    p_driver_code text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_session_id integer;
    v_payload jsonb;
BEGIN
    SELECT public._find_session_id(p_year, p_round, p_session)
    INTO v_session_id;

    IF v_session_id IS NULL THEN
        RETURN jsonb_build_object('driver', p_driver_code, 'tires', '[]'::jsonb);
    END IF;

    -- Use window function to detect compound changes
    WITH ordered_laps AS (
        SELECT DISTINCT ON (lap_number)
            lap_number,
            compound,
            LAG(compound) OVER (ORDER BY lap_number) AS prev_compound
        FROM laps
        WHERE session_id = v_session_id
          AND upper(driver_code) = upper(p_driver_code)
        ORDER BY lap_number
    ),
    stints AS (
        SELECT lap_number AS lap, compound
        FROM ordered_laps
        WHERE prev_compound IS NULL
           OR compound <> prev_compound
        ORDER BY lap_number
    )
    SELECT jsonb_build_object(
        'driver', p_driver_code,
        'tires', COALESCE(
            jsonb_agg(
                jsonb_build_object('lap', lap, 'compound', compound)
                ORDER BY lap
            ),
            '[]'::jsonb
        )
    )
    INTO v_payload
    FROM stints;

    RETURN v_payload;
END;
$$;

