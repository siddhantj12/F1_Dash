SET search_path = public;

-------------------------------------------------------------------------------
-- Helper: locate a session record based on season / round / session label.
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._find_session_id(
    p_year integer,
    p_round integer,
    p_session text
) RETURNS integer
LANGUAGE sql
STABLE
AS $$
    SELECT s.id
    FROM sessions s
    JOIN races r ON r.id = s.race_id
    WHERE r.year = p_year
      AND r.round = p_round
      AND lower(coalesce(s.session_type, s.type)) = lower(p_session)
    ORDER BY s.id
    LIMIT 1;
$$;

-------------------------------------------------------------------------------
-- Get lap summaries for a driver in a session.
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_driver_laps(
    p_year integer,
    p_round integer,
    p_session text,
    p_driver_code text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id integer;
    v_payload jsonb;
BEGIN
    SELECT public._find_session_id(p_year, p_round, p_session)
    INTO v_session_id;

    IF v_session_id IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'lap', l.lap_number,
                'time', l.lap_time,
                'sector1', l.sector1,
                'sector2', l.sector2,
                'sector3', l.sector3,
                'compound', l.compound
            )
            ORDER BY l.lap_number
        ),
        '[]'::jsonb
    )
    INTO v_payload
    FROM laps l
    WHERE l.session_id = v_session_id
      AND upper(l.driver_code) = upper(p_driver_code);

    RETURN v_payload;
END;
$$;

-------------------------------------------------------------------------------
-- Get telemetry samples for a specific lap.
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_lap_telemetry(
    p_year integer,
    p_round integer,
    p_session text,
    p_driver_code text,
    p_lap integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id integer;
    v_lap_id integer;
    v_payload jsonb;
BEGIN
    SELECT public._find_session_id(p_year, p_round, p_session)
    INTO v_session_id;

    IF v_session_id IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT l.id
    INTO v_lap_id
    FROM laps l
    WHERE l.session_id = v_session_id
      AND upper(l.driver_code) = upper(p_driver_code)
      AND l.lap_number = p_lap
    LIMIT 1;

    IF v_lap_id IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'time', EXTRACT(EPOCH FROM t."timestamp"),
                'speed', COALESCE(t.speed, 0),
                'throttle', COALESCE(t.throttle, 0),
                'brake', COALESCE(t.brake, 0),
                'gear', COALESCE(t.gear, 0),
                'x', COALESCE(t.x, 0),
                'y', COALESCE(t.y, 0),
                'distance', COALESCE(t.distance, 0)
            )
            ORDER BY t."timestamp"
        ),
        '[]'::jsonb
    )
    INTO v_payload
    FROM telemetry t
    WHERE t.lap_id = v_lap_id;

    RETURN v_payload;
END;
$$;

