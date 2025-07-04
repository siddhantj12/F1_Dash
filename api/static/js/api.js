/**
 * F1 Dash API Client
 * Handles all API calls to the FastAPI backend
 */

const API_BASE_URL = '/api';

// Helper function to handle API responses
async function handleApiResponse(response, errorMessage) {
    if (!response.ok) {
        console.error(`API Error (${response.status}): ${errorMessage}`);
        const errorText = await response.text();
        throw new Error(`${errorMessage} (${response.status}): ${errorText}`);
    }
    return await response.json();
}

// API client for F1 Dash
const F1DashAPI = {
    /**
     * Get available seasons
     * @returns {Promise<Array>} List of available seasons
     */
    getSeasons: async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/seasons`);
            return await handleApiResponse(response, 'Failed to fetch seasons');
        } catch (error) {
            console.error('Error fetching seasons:', error);
            throw error;
        }
    },

    /**
     * Get races for a specific season
     * @param {number} year - Season year
     * @returns {Promise<Array>} List of races for the season
     */
    getRaces: async (year) => {
        try {
            const response = await fetch(`${API_BASE_URL}/races/${year}`);
            return await handleApiResponse(response, `Failed to fetch races for ${year}`);
        } catch (error) {
            console.error(`Error fetching races for ${year}:`, error);
            throw error;
        }
    },

    /**
     * Get sessions for a specific race
     * @param {number} year - Season year
     * @param {number} round - Race round
     * @returns {Promise<Array>} List of sessions for the race
     */
    getSessions: async (year, round) => {
        try {
            const response = await fetch(`${API_BASE_URL}/sessions/${year}/${round}`);
            return await handleApiResponse(response, `Failed to fetch sessions for ${year} round ${round}`);
        } catch (error) {
            console.error(`Error fetching sessions for ${year} round ${round}:`, error);
            throw error;
        }
    },

    /**
     * Get drivers for a specific session
     * @param {number} year - Season year
     * @param {number} round - Race round
     * @param {string} session - Session name
     * @returns {Promise<Array>} List of drivers in the session
     */
    getDrivers: async (year, round, session) => {
        try {
            console.log(`Fetching drivers: ${year}/${round}/${session}`);
            const response = await fetch(`${API_BASE_URL}/drivers/${year}/${round}/${session}`);
            const data = await handleApiResponse(response, `Failed to fetch drivers for ${session}`);
            console.log("Drivers data:", data);
            return data;
        } catch (error) {
            console.error(`Error fetching drivers for ${session}:`, error);
            throw error;
        }
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
            console.log(`Fetching laps: ${year}/${round}/${session}/${driver}`);
            const response = await fetch(`${API_BASE_URL}/laps/${year}/${round}/${session}/${driver}`);
            const data = await handleApiResponse(response, `Failed to fetch laps for ${driver}`);
            console.log("Laps data:", data);
            return data;
        } catch (error) {
            console.error(`Error fetching laps for ${driver}:`, error);
            throw error;
        }
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
            console.log(`Fetching telemetry: ${year}/${round}/${session}/${driver}/${lap}`);
            const response = await fetch(`${API_BASE_URL}/telemetry/${year}/${round}/${session}/${driver}/${lap}`);
            const data = await handleApiResponse(response, `Failed to fetch telemetry for ${driver} lap ${lap}`);
            console.log("Telemetry data points:", data.length);
            return data;
        } catch (error) {
            console.error(`Error fetching telemetry for ${driver} lap ${lap}:`, error);
            throw error;
        }
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
        try {
            console.log(`Comparing telemetry: ${year}/${round}/${session}/${driver1}/${lap1}/${driver2}/${lap2}`);
            const url = `${API_BASE_URL}/compare/${year}/${round}/${session}/${driver1}/${lap1}/${driver2}/${lap2}`;
            console.log("API URL:", url);
            
            const response = await fetch(url);
            const data = await handleApiResponse(response, `Failed to compare telemetry`);
            console.log("Comparison data received:", data);
            return data;
        } catch (error) {
            console.error(`Error comparing telemetry:`, error);
            throw error;
        }
    },
    
    /**
     * Get track data for a specific race
     * @param {number} year - Season year
     * @param {number} round - Race round
     * @returns {Promise<Object>} Track coordinates and sector boundaries
     */
    getTrackData: async (year, round) => {
        try {
            console.log(`Fetching track data: ${year}/${round}`);
            const response = await fetch(`${API_BASE_URL}/track/${year}/${round}`);
            const data = await handleApiResponse(response, `Failed to fetch track data for ${year} round ${round}`);
            console.log("Track data received:", data);
            return data;
        } catch (error) {
            console.error(`Error fetching track data:`, error);
            throw error;
        }
    }
};

// Export the API client
export default F1DashAPI;
