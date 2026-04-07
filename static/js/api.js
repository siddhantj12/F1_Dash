import { supabase } from './supabase.js'

const API_BASE_URL = '/api';

// Team colors — single source of truth for both api.js and app.js
const TEAM_COLORS = {
    'Red Bull Racing':     '#3671C6',
    'Red Bull':            '#3671C6',
    'Ferrari':             '#F91536',
    'Scuderia Ferrari':    '#F91536',
    'Mercedes':            '#6CD3BF',
    'McLaren':             '#FF8000',
    'Aston Martin':        '#358C75',
    'Alpine':              '#FF87BC',
    'AlphaTauri':          '#5E8FAA',
    'Scuderia AlphaTauri': '#5E8FAA',
    'RB':                  '#5E8FAA',
    'Haas F1 Team':        '#B6BABD',
    'Haas':                '#B6BABD',
    'Williams':            '#64C4FF',
    'Alfa Romeo':          '#C92D4B',
    'Kick Sauber':         '#00CF46',
    'Sauber':              '#00CF46',
    'Racing Point':        '#F596C8',
    'Renault':             '#FFF500',
};
export { TEAM_COLORS };

function teamColor(teamName) {
    if (!teamName) return '#E10600';
    return TEAM_COLORS[teamName.trim()] || '#E10600';
}

async function apiFetch(path, mockFn, supabaseOptions = null) {
  try {
    if (supabaseOptions) {
      const { table, select = '*', filter = {}, mapFn = null } = supabaseOptions;
      let query = supabase.from(table).select(select);
      for (const [key, value] of Object.entries(filter)) {
        query = query.eq(key, value);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return mapFn ? data.map(mapFn) : data;
      }
      if (error) console.warn(`[Supabase] Error fetching ${path}:`, error.message);
    }
    const resp = await axios.get(`${API_BASE_URL}${path}`);
    return resp.data;
  } catch (e) {
    console.warn(`[API] Fetch failed for ${path}:`, e.message);
    return mockFn ? mockFn() : null;
  }
}

// API client for F1 Dash
const F1DashAPI = {
    /**
     * Get available seasons
     * @returns {Promise<Array>} List of available seasons
     */
    getSeasons: async () => {
        return await apiFetch('/seasons', null, { table: 'seasons', select: 'year', mapFn: d => d.year });
    },

    /**
     * Get races for a specific season
     * @param {number} year - Season year
     * @returns {Promise<Array>} List of races for the season
     */
    getRaces: async (year) => {
        return await apiFetch(`/races/${year}`, null, { 
            table: 'races', 
            select: 'round, race_name, circuit_name', 
            filter: { year: year },
            mapFn: d => ({ round: d.round, name: d.race_name, circuit: d.circuit_name })
        });
    },

    /**
     * Get sessions for a specific race
     * @param {number} year - Season year
     * @param {number} round - Race round
     * @returns {Promise<Array>} List of sessions for the race
     */
    getSessions: async (year, round) => {
        try {
            const raceResponse = await supabase.from('races').select('id').eq('year', year).eq('round', round).single();
            if (!raceResponse.error && raceResponse.data) {
                const { data, error } = await supabase.from('sessions').select('type').eq('race_id', raceResponse.data.id);
                if (!error && data && data.length > 0) return data.map(d => d.type);
            }
        } catch (e) {
            console.warn('[Supabase] Sessions lookup failed, falling back:', e.message);
        }
        return await apiFetch(`/sessions/${year}/${round}`);
    },

    /**
     * Get drivers for a specific session
     * @param {number} year - Season year
     * @param {number} round - Race round
     * @param {string} session - Session name
     * @returns {Promise<Array>} List of drivers in the session
     */
    getDrivers: async (year, round, session) => {
        return await apiFetch(`/drivers/${year}/${round}/${session}`, null, { 
            table: 'drivers', 
            select: 'driver_code, first_name, last_name, team_name', 
            filter: { year: year },
            mapFn: d => ({ 
                code: d.driver_code, 
                name: `${d.first_name} ${d.last_name}`, 
                team: d.team_name,
                color: teamColor(d.team_name)
            })
        });
    },

    /**
     * Get laps for a specific driver in a session
     * @param {number} year - Season year
     * @param {number} round - Race round
     * @param {string} session - Session name
     * @param {string} driver - Driver code
     * @returns {Promise<Array>} List of laps for the driver
     */
    getLaps: async (year, round, session, driver) => {
        try {
            const raceResponse = await supabase.from('races').select('id').eq('year', year).eq('round', round).single();
            if (!raceResponse.error && raceResponse.data) {
                const sessionResponse = await supabase.from('sessions').select('id').eq('race_id', raceResponse.data.id).eq('type', session).single();
                if (!sessionResponse.error && sessionResponse.data) {
                    const { data, error } = await supabase.from('laps').select('lap_number, lap_time, sector1, sector2, sector3, compound').eq('session_id', sessionResponse.data.id).eq('driver_code', driver);
                    if (!error && data && data.length > 0) {
                        return data.map(d => ({ lap: d.lap_number, time: d.lap_time, sector1: d.sector1, sector2: d.sector2, sector3: d.sector3, compound: d.compound }));
                    }
                }
            }
        } catch (e) {
            console.warn('[Supabase] Laps lookup failed, falling back:', e.message);
        }
        return await apiFetch(`/laps/${year}/${round}/${session}/${driver}`);
    },

    /**
     * Get telemetry data for a specific lap
     * @param {number} year - Season year
     * @param {number} round - Race round
     * @param {string} session - Session name
     * @param {string} driver - Driver code
     * @param {number} lap - Lap number
     * @returns {Promise<Object>} Telemetry data for the lap
     */
    getTelemetry: async (year, round, session, driver, lap) => {
        try {
            const raceRes = await supabase.from('races').select('id').eq('year', year).eq('round', round).single();
            if (!raceRes.error && raceRes.data) {
                const sessRes = await supabase.from('sessions').select('id').eq('race_id', raceRes.data.id).eq('type', session).single();
                if (!sessRes.error && sessRes.data) {
                    const lapRes = await supabase.from('laps').select('id').eq('session_id', sessRes.data.id).eq('driver_code', driver).eq('lap_number', lap).single();
                    if (!lapRes.error && lapRes.data) {
                        const { data, error } = await supabase.from('telemetry').select('timestamp, speed, throttle, brake, gear, x, y').eq('lap_id', lapRes.data.id);
                        if (!error && data && data.length > 0) {
                            return data.map(d => ({ time: d.timestamp, speed: d.speed, throttle: d.throttle, brake: d.brake, gear: d.gear, x: d.x, y: d.y }));
                        }
                    }
                }
            }
        } catch (e) {
            console.warn(`[Supabase] Telemetry lookup failed, falling back: ${e.message}`);
        }
        return await apiFetch(`/telemetry/${year}/${round}/${session}/${driver}/${lap}`);
    },

    /**
     * Compare telemetry data for two drivers on specific laps
     * @param {number} year - Season year
     * @param {number} round - Race round
     * @param {string} session - Session name
     * @param {string} driver1 - First driver code
     * @param {number} lap1 - First driver lap number
     * @param {string} driver2 - Second driver code
     * @param {number} lap2 - Second driver lap number
     * @returns {Promise<Object>} Comparison data for both drivers
     */
    compareTelemetry: async (year, round, session, driver1, lap1, driver2, lap2) => {
        return await apiFetch(`/compare/${year}/${round}/${session}/${driver1}/${lap1}/${driver2}/${lap2}`);
    },
    
    /**
     * Get track data for a specific race
     * @param {number} year - Season year
     * @param {number} round - Race round
     * @returns {Promise<Object>} Track coordinates and sector boundaries
     */
    /**
     * Get standings at a specific lap in a session
     * @param {number} year - Season year
     * @param {number} round - Race round
     * @param {string} session - Session name
     * @param {number} lap - Lap number
     * @returns {Promise<Array>} Standings at that lap
     */
    getStandings: async (year, round, session, lap) => {
        return await apiFetch(`/standings/${year}/${round}/${session}/${lap}`);
    },

    getTrackData: async (year, round) => {
        // Try Supabase first (returns a single track layout per year+round)
        const { data, error } = await supabase
            .from('track_layouts')
            .select('circuit_name, x_coords, y_coords, distances, sector_boundaries')
            .eq('year', year)
            .eq('round', round)
            .single();

        if (!error && data && data.x_coords && data.x_coords.length > 0) {
            return {
                circuit_name: data.circuit_name,
                coordinates: { x: data.x_coords, y: data.y_coords, distance: data.distances },
                sector_boundaries: data.sector_boundaries || []
            };
        }

        if (error) console.warn('[Supabase] Track layout not found, falling back to FastAPI:', error.message);

        // Fall back to FastAPI (returns full track object including sector_boundaries)
        const resp = await axios.get(`${API_BASE_URL}/track/${year}/${round}`);
        return resp.data;
    }
};

// Export the API client
export default F1DashAPI;
