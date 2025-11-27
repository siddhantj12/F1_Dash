SET search_path = public;

-------------------------------------------------------------------------------
-- Get drivers for a specific session (by year/round/session).
-- Returns driver code, full name, team, and a fallback hex color.
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_drivers(
    p_year integer,
    p_round integer,
    p_session text
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
    -- Find session id
    SELECT public._find_session_id(p_year, p_round, p_session)
    INTO v_session_id;

    IF v_session_id IS NULL THEN
        -- No session found, return drivers for that year as fallback
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'code', d.driver_code,
                    'name', d.first_name || ' ' || d.last_name,
                    'team', d.team_name,
                    'color', public._team_color(d.team_name)
                )
                ORDER BY d.driver_code
            ),
            '[]'::jsonb
        )
        INTO v_payload
        FROM drivers d
        WHERE d.year = p_year;

        RETURN v_payload;
    END IF;

    -- Get unique drivers from laps for that session
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'code', sub.driver_code,
                'name', COALESCE(d.first_name || ' ' || d.last_name, sub.driver_code),
                'team', COALESCE(d.team_name, 'Unknown'),
                'color', public._team_color(COALESCE(d.team_name, ''))
            )
            ORDER BY sub.driver_code
        ),
        '[]'::jsonb
    )
    INTO v_payload
    FROM (
        SELECT DISTINCT upper(l.driver_code) AS driver_code
        FROM laps l
        WHERE l.session_id = v_session_id
    ) sub
    LEFT JOIN drivers d
        ON upper(d.driver_code) = sub.driver_code
       AND d.year = p_year;

    RETURN v_payload;
END;
$$;

-------------------------------------------------------------------------------
-- Helper: map team name to hex color.
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._team_color(p_team text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE lower(p_team)
        WHEN 'red bull racing' THEN '#3671C6'
        WHEN 'red bull' THEN '#3671C6'
        WHEN 'mercedes' THEN '#6CD3BF'
        WHEN 'ferrari' THEN '#F91536'
        WHEN 'mclaren' THEN '#F58020'
        WHEN 'aston martin' THEN '#358C75'
        WHEN 'alpine' THEN '#2293D1'
        WHEN 'williams' THEN '#37BEDD'
        WHEN 'rb' THEN '#6692FF'
        WHEN 'alphatauri' THEN '#4E7C9B'
        WHEN 'alfa romeo' THEN '#B12039'
        WHEN 'kick sauber' THEN '#52E252'
        WHEN 'sauber' THEN '#52E252'
        WHEN 'haas f1 team' THEN '#B6BABD'
        WHEN 'haas' THEN '#B6BABD'
        WHEN 'racing point' THEN '#F596C8'
        WHEN 'renault' THEN '#FFF500'
        ELSE '#888888'
    END;
$$;

