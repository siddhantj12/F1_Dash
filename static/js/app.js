import F1DashAPI from './api.js';
import TrackVisualizer from './track.js';

// Debug helper function - set to false to disable
const DEBUG_ENABLED = true;

// Debug helper function
function debug(message, data) {
    if (!DEBUG_ENABLED) return;
    
    console.log(`[F1-Dash] ${message}`, data);
    const debugElement = document.getElementById('debug-info');
    if (debugElement) {
        debugElement.style.display = 'block';
        debugElement.innerHTML += `<div>${message}: ${JSON.stringify(data, null, 2)}</div>\n`;
        
        // Scroll to bottom
        debugElement.scrollTop = debugElement.scrollHeight;
    }
}

// Clear debug
function clearDebug() {
    const debugElement = document.getElementById('debug-info');
    if (debugElement) {
        debugElement.innerHTML = '';
    }
}

// Function to get team color
function getTeamColor(teamName) {
    if (!teamName) return TEAM_COLORS.DEFAULT;
    const color = TEAM_COLORS[teamName.trim()] || TEAM_COLORS.DEFAULT;
    debug(`Team color for "${teamName}"`, color);
    return color;
}

// Function to extract team name from option text
function extractTeamName(optionText) {
    if (!optionText) return null;
    const match = optionText.match(/\(([^)]+)\)/);
    return match ? match[1].trim() : null;
}

// DOM Elements
const seasonSelect = document.getElementById('season-select');
const raceSelect = document.getElementById('race-select');
const sessionSelect = document.getElementById('session-select');
const driverSelect = document.getElementById('driver-select');
const lapSelect = document.getElementById('lap-select');
const loadButton = document.getElementById('load-data');
const statusElement = document.getElementById('status');
const primaryDriverName = document.getElementById('primary-driver-name');
const primaryDriverTeam = document.getElementById('primary-driver-team');
const primaryDriverAvatar = document.getElementById('primary-driver-avatar');
const compareDriverName = document.getElementById('compare-driver-name');
const compareDriverTeam = document.getElementById('compare-driver-team');
const compareDriverAvatar = document.getElementById('compare-driver-avatar');
const trackTitle = document.getElementById('track-title');
const trackSeasonPill = document.getElementById('track-season-pill');
const insightOne = document.getElementById('insight-1');
const insightTwo = document.getElementById('insight-2');
const insightThree = document.getElementById('insight-3');
const standingsList = document.getElementById('standings-list');

// Chart containers
const speedChartContainer = document.getElementById('speed-chart');
const throttleBrakeChartContainer = document.getElementById('throttle-brake-chart');
const gearChartContainer = document.getElementById('gear-chart');

// Chart instances
let speedChart = null;
let throttleBrakeChart = null;
let gearChart = null;

// Add these new DOM Elements
const compareDriverSelect = document.getElementById('compare-driver-select');
const compareLapSelect = document.getElementById('compare-lap-select');
const trackContainer = document.getElementById('track-chart');

// Add track visualizer
let trackVisualizer = null;

// Add comparison charts
let speedComparisonChart = null;
let throttleBrakeComparisonChart = null;
let gearComparisonChart = null;

// Initialize the application
async function initApp() {
    try {
        setStatus('Loading seasons...', true);
        clearDebug();
        debug("Initializing F1 Dash application", { version: "1.0.0" });
        
        // Load seasons
        const seasons = await F1DashAPI.getSeasons();
        debug("Available seasons", seasons);
        
        // Populate season select
        seasons.forEach(season => {
            const option = document.createElement('option');
            option.value = season;
            option.textContent = season;
            seasonSelect.appendChild(option);
        });
        
        // Enable season select
        seasonSelect.disabled = false;
        
        setStatus('Ready', false);

        setupStandings();
        
        // Add event listeners
        setupEventListeners();
    } catch (error) {
        console.error('Failed to initialize app:', error);
        setStatus(`Error: ${error.message}`, false);
    }
}

// Helper function to set status
function setStatus(message, isLoading = false) {
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = isLoading ? 'loading' : '';
    }
}

function updateDriverCard(type, driver) {
    const isPrimary = type === 'primary';
    const nameEl = isPrimary ? primaryDriverName : compareDriverName;
    const teamEl = isPrimary ? primaryDriverTeam : compareDriverTeam;
    const avatarEl = isPrimary ? primaryDriverAvatar : compareDriverAvatar;

    if (!nameEl || !teamEl || !avatarEl) return;

    if (!driver) {
        nameEl.textContent = isPrimary ? 'Select a driver' : 'Optional';
        teamEl.textContent = '—';
        avatarEl.textContent = isPrimary ? 'P1' : 'C2';
        avatarEl.style.background = 'rgba(225, 6, 0, 0.15)';
        avatarEl.style.borderColor = 'rgba(225, 6, 0, 0.3)';
        return;
    }

    nameEl.textContent = driver.name || driver.code || 'Unknown';
    teamEl.textContent = driver.team || '—';
    avatarEl.textContent = driver.code || (driver.name ? driver.name.slice(0, 2).toUpperCase() : 'F1');

    if (driver.color) {
        avatarEl.style.background = `${driver.color}22`;
        avatarEl.style.borderColor = `${driver.color}66`;
    }
}

function updateInsights(messages) {
    const defaults = [
        'Select a session to surface insights.',
        'Load two drivers to compare lap pace.',
        'Track sectors highlight time gains.'
    ];
    const text = messages && messages.length ? messages : defaults;
    if (insightOne) insightOne.textContent = text[0] || defaults[0];
    if (insightTwo) insightTwo.textContent = text[1] || defaults[1];
    if (insightThree) insightThree.textContent = text[2] || defaults[2];
}

function updateTrackLabel() {
    if (!trackSeasonPill) return;
    const season = seasonSelect.value;
    const raceOption = raceSelect.options[raceSelect.selectedIndex];
    const raceLabel = raceOption && raceOption.value ? raceOption.textContent.split(' - ')[0] : '';
    const session = sessionSelect.value;
    const labelParts = [];
    if (season) labelParts.push(season);
    if (raceLabel) labelParts.push(raceLabel);
    if (session) labelParts.push(session);
    trackSeasonPill.textContent = labelParts.length ? labelParts.join(' • ') : '—';
}

function setupStandings() {
    if (!standingsList) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/api/ws/positions`;
    let socket;

    try {
        socket = new WebSocket(wsUrl);
    } catch (error) {
        console.warn('Standings websocket failed to start', error);
        return;
    }

    socket.onmessage = (event) => {
        try {
            const positions = JSON.parse(event.data);
            if (!Array.isArray(positions) || positions.length === 0) return;
            standingsList.innerHTML = '';
            positions
                .sort((a, b) => a.position - b.position)
                .slice(0, 8)
                .forEach((item) => {
                    const row = document.createElement('div');
                    row.className = 'standing-row';
                    const gap = item.gap === null || item.gap === undefined ? '—' : `+${item.gap.toFixed(3)}`;
                    row.innerHTML = `
                        <div class="standing-driver">
                            <span class="standing-position">${item.position}</span>
                            <span>${item.driver}</span>
                        </div>
                        <span class="driver-meta">${gap}</span>
                    `;
                    standingsList.appendChild(row);
                });
        } catch (error) {
            console.error('Failed to parse standings data', error);
        }
    };

    socket.onerror = () => {
        if (standingsList) {
            standingsList.innerHTML = `
                <div class="standing-row">
                    <div class="standing-driver">
                        <span class="standing-position">—</span>
                        <span>Standings unavailable</span>
                    </div>
                    <span class="driver-meta">—</span>
                </div>
            `;
        }
    };
}

// Set up event listeners
function setupEventListeners() {
    // Season select
    seasonSelect.addEventListener('change', async () => {
        resetSelects('race');
        updateTrackLabel();
        
        if (!seasonSelect.value) return;
        
        try {
            setStatus(`Loading races for ${seasonSelect.value}...`, true);
            
            // Load races for selected season
            const races = await F1DashAPI.getRaces(seasonSelect.value);
            debug("Races loaded", races);
            
            // Populate race select
            races.forEach(race => {
                const option = document.createElement('option');
                option.value = race.round;
                option.textContent = `${race.round}. ${race.name} - ${race.circuit}`;
                raceSelect.appendChild(option);
            });
            
            // Enable race select
            raceSelect.disabled = false;
            
            setStatus('Ready', false);
        } catch (error) {
            console.error('Failed to load races:', error);
            setStatus(`Error: ${error.message}`, false);
        }
    });
    
    // Race select
    raceSelect.addEventListener('change', async () => {
        resetSelects('session');
        updateTrackLabel();
        
        if (!raceSelect.value) return;
        
        try {
            setStatus(`Loading sessions...`, true);
            
            // Load sessions for selected race
            const sessions = await F1DashAPI.getSessions(seasonSelect.value, raceSelect.value);
            debug("Sessions loaded", sessions);
            
            // Populate session select
            sessions.forEach(session => {
                const option = document.createElement('option');
                option.value = session;
                option.textContent = session;
                sessionSelect.appendChild(option);
            });
            
            // Enable session select
            sessionSelect.disabled = false;
            
            setStatus('Ready', false);
        } catch (error) {
            console.error('Failed to load sessions:', error);
            setStatus(`Error: ${error.message}`, false);
        }
    });
    
    // Session select
    sessionSelect.addEventListener('change', async () => {
        resetSelects('driver');
        updateTrackLabel();
        
        if (!sessionSelect.value) return;
        
        try {
            setStatus(`Loading drivers...`, true);
            
            // Load drivers for selected session
            const drivers = await F1DashAPI.getDrivers(
                seasonSelect.value, 
                raceSelect.value, 
                sessionSelect.value
            );
            
            debug("Drivers loaded", drivers);
            
            if (!drivers || drivers.length === 0) {
                throw new Error('No drivers found for this session');
            }
            
            // Populate driver select
            drivers.forEach(driver => {
                const option = document.createElement('option');
                option.value = driver.code;
                option.textContent = `${driver.code} - ${driver.name} (${driver.team})`;
                option.dataset.team = driver.team;
                option.dataset.color = driver.color;
                option.dataset.name = driver.name;
                driverSelect.appendChild(option);
            });
            
            // Enable driver select
            driverSelect.disabled = false;
            
            // Populate compare driver select (same list)
            compareDriverSelect.innerHTML = '<option value="">Compare with Driver (optional)</option>';
            drivers.forEach(driver => {
                const option = document.createElement('option');
                option.value = driver.code;
                option.textContent = `${driver.code} - ${driver.name} (${driver.team})`;
                option.dataset.team = driver.team;
                option.dataset.color = driver.color;
                option.dataset.name = driver.name;
                compareDriverSelect.appendChild(option);
            });
            
            // Enable compare driver select
            compareDriverSelect.disabled = false;
            
            setStatus('Ready', false);
        } catch (error) {
            console.error('Failed to load drivers:', error);
            setStatus(`Error: ${error.message}`, false);
        }
    });
    
    // Driver select
    driverSelect.addEventListener('change', async () => {
        resetSelects('lap');
        
        if (!driverSelect.value) return;
        
        try {
            setStatus(`Loading laps for ${driverSelect.value}...`, true);
            
            // Load laps for selected driver
            const laps = await F1DashAPI.getLaps(
                seasonSelect.value, 
                raceSelect.value, 
                sessionSelect.value, 
                driverSelect.value
            );
            
            debug("Laps loaded for driver", { driver: driverSelect.value, laps });
            
            if (!laps || laps.length === 0) {
                throw new Error('No laps found for this driver');
            }
            
            // Populate lap select with more detailed information
            laps.forEach(lap => {
                const option = document.createElement('option');
                option.value = lap.lap;
                
                // Create more detailed lap info with sector times if available
                let lapInfo = `Lap ${lap.lap} - ${lap.time}`;
                
                // Add sector times if available
                if (lap.sector1 && lap.sector2 && lap.sector3) {
                    lapInfo += ` (S1: ${lap.sector1}, S2: ${lap.sector2}, S3: ${lap.sector3})`;
                }
                
                // Add compound info if available
                if (lap.compound) {
                    lapInfo += ` [${lap.compound}]`;
                }
                
                option.textContent = lapInfo;
                lapSelect.appendChild(option);
            });
            
            // Enable lap select
            lapSelect.disabled = false;
            
            const selectedOption = driverSelect.options[driverSelect.selectedIndex];
            updateDriverCard('primary', {
                code: driverSelect.value,
                name: selectedOption.dataset.name,
                team: selectedOption.dataset.team,
                color: selectedOption.dataset.color
            });

            setStatus('Ready', false);
        } catch (error) {
            console.error('Failed to load laps:', error);
            setStatus(`Error: ${error.message}`, false);
        }
    });
    
    // Lap select
    lapSelect.addEventListener('change', () => {
        loadButton.disabled = !lapSelect.value;
    });
    
    // Compare driver select
    compareDriverSelect.addEventListener('change', async () => {
        debug("Compare driver changed", compareDriverSelect.value);
        compareLapSelect.innerHTML = '<option value="">Select Lap</option>';
        compareLapSelect.disabled = true;
        
        if (!compareDriverSelect.value) {
            return;
        }
        
        try {
            setStatus(`Loading laps for ${compareDriverSelect.value}...`, true);
            
            // Disable comparison dropdown if same driver is selected
            if (compareDriverSelect.value === driverSelect.value) {
                alert("Please select a different driver for comparison");
                compareDriverSelect.value = "";
                setStatus('Ready', false);
                return;
            }
            
            // Load laps for selected comparison driver
            const laps = await F1DashAPI.getLaps(
                seasonSelect.value, 
                raceSelect.value, 
                sessionSelect.value, 
                compareDriverSelect.value
            );
            
            debug("Laps loaded for comparison driver", { driver: compareDriverSelect.value, laps });
            
            if (!laps || laps.length === 0) {
                throw new Error('No laps found for this driver');
            }
            
            // Populate lap select with more detailed information
            laps.forEach(lap => {
                const option = document.createElement('option');
                option.value = lap.lap;
                
                // Create more detailed lap info with sector times if available
                let lapInfo = `Lap ${lap.lap} - ${lap.time}`;
                
                // Add sector times if available
                if (lap.sector1 && lap.sector2 && lap.sector3) {
                    lapInfo += ` (S1: ${lap.sector1}, S2: ${lap.sector2}, S3: ${lap.sector3})`;
                }
                
                // Add compound info if available
                if (lap.compound) {
                    lapInfo += ` [${lap.compound}]`;
                }
                
                option.textContent = lapInfo;
                compareLapSelect.appendChild(option);
            });
            
            // Enable lap select
            compareLapSelect.disabled = false;
            
            const selectedOption = compareDriverSelect.options[compareDriverSelect.selectedIndex];
            updateDriverCard('compare', {
                code: compareDriverSelect.value,
                name: selectedOption.dataset.name,
                team: selectedOption.dataset.team,
                color: selectedOption.dataset.color
            });
            
            setStatus('Ready', false);
        } catch (error) {
            console.error(`Failed to load laps for ${compareDriverSelect.value}:`, error);
            setStatus(`Error: ${error.message}`, false);
        }
    });
    
    // Load button
    loadButton.addEventListener('click', async () => {
        try {
            setStatus('Loading data...', true);
            
            // Initialize track visualizer if not yet created
            if (!trackVisualizer) {
                trackVisualizer = new TrackVisualizer('track-chart');
            }
            
            // Get selected driver's team and color
            const driverOption = driverSelect.options[driverSelect.selectedIndex];
            const driverTeam = driverOption.dataset.team;
            const driverColor = driverOption.dataset.color;
            
            debug("Selected driver info", {
                code: driverSelect.value,
                team: driverTeam,
                color: driverColor
            });
            
            // Load track data
            const trackLoaded = await trackVisualizer.loadTrack(
                seasonSelect.value,
                raceSelect.value
            );
            
            debug("Track loaded", trackLoaded);

            if (trackLoaded && trackVisualizer.trackData && trackTitle) {
                trackTitle.textContent = trackVisualizer.trackData.circuit_name || 'Track + Telemetry';
            }
            
            // Load telemetry data for primary driver
            const telemetry = await F1DashAPI.getTelemetry(
                seasonSelect.value,
                raceSelect.value,
                sessionSelect.value,
                driverSelect.value,
                lapSelect.value
            );
            
            debug("Telemetry loaded points", telemetry.length);
            
            // If comparison driver and lap are selected, load comparison data
            if (compareDriverSelect.value && compareLapSelect.value) {
                debug("Starting comparison mode", {
                    driver1: driverSelect.value,
                    lap1: lapSelect.value,
                    driver2: compareDriverSelect.value,
                    lap2: compareLapSelect.value
                });
                
                // Get comparison driver's team and color
                const compareDriverOption = compareDriverSelect.options[compareDriverSelect.selectedIndex];
                const compareDriverTeam = compareDriverOption.dataset.team || 
                    extractTeamName(compareDriverOption.textContent);
                const compareDriverColor = compareDriverOption.dataset.color;
                
                debug("Comparison driver info", {
                    code: compareDriverSelect.value,
                    team: compareDriverTeam,
                    color: compareDriverColor
                });
                
                // Load comparison data
                try {
                    const comparisonData = await F1DashAPI.compareTelemetry(
                        seasonSelect.value,
                        raceSelect.value,
                        sessionSelect.value,
                        driverSelect.value,
                        lapSelect.value,
                        compareDriverSelect.value,
                        compareLapSelect.value
                    );
                    
                    debug("Comparison data loaded", {
                        driver1: comparisonData.driver1.code,
                        driver2: comparisonData.driver2.code,
                        delta: comparisonData.delta
                    });
                    
                    // Ensure we have team colors if API doesn't return them
                    if (!comparisonData.driver1.color || comparisonData.driver1.color === "#FF0000") {
                        comparisonData.driver1.color = driverColor;
                    }
                    
                    if (!comparisonData.driver2.color || comparisonData.driver2.color === "#0000FF") {
                        comparisonData.driver2.color = compareDriverColor;
                    }
                    
                    // Update track visualization with comparison data
                    trackVisualizer.setComparisonData(comparisonData);
                    
                    // Render comparison charts
                    renderComparisonCharts(comparisonData);

                    const avg = (values) => values.reduce((sum, v) => sum + v, 0) / (values.length || 1);
                    const avgSpeed1 = avg(comparisonData.driver1.data.speed);
                    const avgSpeed2 = avg(comparisonData.driver2.data.speed);
                    const speedDelta = avgSpeed1 - avgSpeed2;
                    const speedLeader = speedDelta >= 0 ? comparisonData.driver1.code : comparisonData.driver2.code;
                    const speedValue = Math.abs(speedDelta).toFixed(1);
                    updateInsights([
                        `${speedLeader} avg speed +${speedValue} km/h`,
                        `Compared laps: ${comparisonData.driver1.lap} vs ${comparisonData.driver2.lap}`,
                        `Use track colors to see sector winners`
                    ]);
                    
                    setStatus('Comparison data loaded', false);
                } catch (error) {
                    console.error('Failed to load comparison data:', error);
                    setStatus(`Error with comparison: ${error.message}`, false);
                    
                    // Fallback to single driver view
                    renderCharts(telemetry, driverSelect.value, driverColor);
                }
            } else {
                // Render single driver charts with appropriate color
                renderCharts(telemetry, driverSelect.value, driverColor);
                trackVisualizer.setSingleDriverColor(driverColor);
                
                const avgSpeed = telemetry.reduce((sum, point) => sum + point.speed, 0) / (telemetry.length || 1);
                const maxSpeed = Math.max(...telemetry.map(point => point.speed));
                updateInsights([
                    `${driverSelect.value} avg speed ${avgSpeed.toFixed(1)} km/h`,
                    `Peak speed ${maxSpeed.toFixed(1)} km/h`,
                    `Lap ${lapSelect.value} loaded with ${telemetry.length} samples`
                ]);

                setStatus('Telemetry data loaded', false);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
            setStatus(`Error: ${error.message}`, false);
        }
    });
    
    // Debug toggle - click on status to toggle debug
    statusElement.addEventListener('click', () => {
        const debugElement = document.getElementById('debug-info');
        if (debugElement) {
            debugElement.style.display = debugElement.style.display === 'none' ? 'block' : 'none';
        }
    });
}

// Reset selects based on the changed select
function resetSelects(changedSelect) {
    if (changedSelect === 'race' || changedSelect === 'all') {
        raceSelect.innerHTML = '<option value="">Select Race</option>';
        raceSelect.disabled = true;
        resetSelects('session');
    }
    
    if (changedSelect === 'session' || changedSelect === 'all') {
        sessionSelect.innerHTML = '<option value="">Select Session</option>';
        sessionSelect.disabled = true;
        resetSelects('driver');
    }
    
    if (changedSelect === 'driver' || changedSelect === 'all') {
        driverSelect.innerHTML = '<option value="">Select Driver</option>';
        driverSelect.disabled = true;
        compareDriverSelect.innerHTML = '<option value="">Compare with Driver (optional)</option>';
        compareDriverSelect.disabled = true;
        resetSelects('lap');
    }
    
    if (changedSelect === 'lap' || changedSelect === 'all') {
        lapSelect.innerHTML = '<option value="">Select Lap</option>';
        lapSelect.disabled = true;
        compareLapSelect.innerHTML = '<option value="">Select Lap</option>';
        compareLapSelect.disabled = true;
        loadButton.disabled = true;
    }
    
    // Remove any comparison info that might be displayed
    const existingComparison = document.querySelector('.comparison-info');
    if (existingComparison) {
        existingComparison.remove();
    }
    
    // Clear charts
    clearCharts();
    updateDriverCard('primary', null);
    updateDriverCard('compare', null);
    updateInsights();
}

// Clear all charts
function clearCharts() {
    if (speedChart) {
        speedChart.destroy();
        speedChart = null;
    }
    
    if (throttleBrakeChart) {
        throttleBrakeChart.destroy();
        throttleBrakeChart = null;
    }
    
    if (gearChart) {
        gearChart.destroy();
        gearChart = null;
    }
    
    speedChartContainer.innerHTML = '<div class="loading">Select data to display speed chart</div>';
    throttleBrakeChartContainer.innerHTML = '<div class="loading">Select data to display throttle/brake chart</div>';
    gearChartContainer.innerHTML = '<div class="loading">Select data to display gear chart</div>';
}

// Render charts with telemetry data
function renderCharts(telemetry, driverCode, driverColor) {
    // Clear existing charts
    clearCharts();
    
    debug("Rendering single driver charts", {driverCode, driverColor});
    
    // Format telemetry data for charts
    const labels = telemetry.map(data => data.time.toFixed(1));
    const speedData = telemetry.map(data => data.speed);
    const throttleData = telemetry.map(data => data.throttle);
    const brakeData = telemetry.map(data => data.brake);
    const gearData = telemetry.map(data => data.gear);
    
    // Create canvas elements
    speedChartContainer.innerHTML = '<canvas></canvas>';
    throttleBrakeChartContainer.innerHTML = '<canvas></canvas>';
    gearChartContainer.innerHTML = '<canvas></canvas>';
    
    // Ensure we have a valid color (default to red if not)
    const chartColor = driverColor || '#e10600';
    
    // Speed chart
    speedChart = new Chart(speedChartContainer.querySelector('canvas'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${driverCode} Speed (km/h)`,
                data: speedData,
                borderColor: chartColor,
                backgroundColor: `${chartColor}33`, // Add transparency
                borderWidth: 2,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time (seconds)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Speed (km/h)'
                    },
                    min: 0
                }
            }
        }
    });
    
    // Throttle/Brake chart
    throttleBrakeChart = new Chart(throttleBrakeChartContainer.querySelector('canvas'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: `${driverCode} Throttle (%)`,
                    data: throttleData,
                    borderColor: chartColor,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.1,
                    yAxisID: 'y'
                },
                {
                    label: `${driverCode} Brake (%)`,
                    data: brakeData,
                    borderColor: '#ff3333',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.1,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time (seconds)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Percentage (%)'
                    },
                    min: 0,
                    max: 100
                }
            }
        }
    });
    
    // Gear chart
    gearChart = new Chart(gearChartContainer.querySelector('canvas'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${driverCode} Gear`,
                data: gearData,
                borderColor: chartColor,
                backgroundColor: `${chartColor}33`, // Add transparency
                borderWidth: 2,
                fill: true,
                stepped: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time (seconds)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Gear'
                    },
                    min: 0,
                    max: 8,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Function for rendering comparison charts
function renderComparisonCharts(comparisonData) {
    // Clear existing charts
    clearCharts();
    
    const { driver1, driver2, delta } = comparisonData;
    
    debug("Rendering comparison charts", {
        driver1: {code: driver1.code, color: driver1.color},
        driver2: {code: driver2.code, color: driver2.color},
        delta: delta
    });
    
    // Create canvas elements
    speedChartContainer.innerHTML = '<canvas></canvas>';
    throttleBrakeChartContainer.innerHTML = '<canvas></canvas>';
    gearChartContainer.innerHTML = '<canvas></canvas>';
    
    // Remove any existing comparison info
    const existingComparison = document.querySelector('.comparison-info');
    if (existingComparison) {
        existingComparison.remove();
    }
    
    // Add comparison info above the charts
    const comparisonInfoDiv = document.createElement('div');
    comparisonInfoDiv.className = 'comparison-info';
    
    // Add driver 1 info
    const driver1InfoDiv = document.createElement('div');
    driver1InfoDiv.className = 'driver-info';
    const driver1ColorIndicator = document.createElement('div');
    driver1ColorIndicator.className = 'color-indicator';
    driver1ColorIndicator.style.backgroundColor = driver1.color;
    driver1InfoDiv.appendChild(driver1ColorIndicator);
    driver1InfoDiv.innerHTML += `<span>${driver1.code} - Lap ${driver1.lap} (${driver1.lapTime})</span>`;
    comparisonInfoDiv.appendChild(driver1InfoDiv);
    
    // Add delta info
    const deltaValue = delta.time;
    const deltaInfoDiv = document.createElement('div');
    deltaInfoDiv.className = 'delta';
    const deltaFormatted = Math.abs(deltaValue).toFixed(3);
    if (deltaValue < 0) {
        deltaInfoDiv.innerHTML = `<span class="delta-negative">${driver1.code} faster by ${deltaFormatted}s</span>`;
    } else {
        deltaInfoDiv.innerHTML = `<span class="delta-positive">${driver2.code} faster by ${deltaFormatted}s</span>`;
    }
    comparisonInfoDiv.appendChild(deltaInfoDiv);
    
    // Add driver 2 info
    const driver2InfoDiv = document.createElement('div');
    driver2InfoDiv.className = 'driver-info';
    const driver2ColorIndicator = document.createElement('div');
    driver2ColorIndicator.className = 'color-indicator';
    driver2ColorIndicator.style.backgroundColor = driver2.color;
    driver2InfoDiv.appendChild(driver2ColorIndicator);
    driver2InfoDiv.innerHTML += `<span>${driver2.code} - Lap ${driver2.lap} (${driver2.lapTime})</span>`;
    comparisonInfoDiv.appendChild(driver2InfoDiv);
    
    // Insert comparison info before the first chart
    document.querySelector('.charts').insertBefore(comparisonInfoDiv, speedChartContainer);
    
    // Prepare comparison data
    const timeLabels = driver1.data.time.map(t => parseFloat(t).toFixed(1));
    
    // Speed comparison chart
    speedComparisonChart = new Chart(speedChartContainer.querySelector('canvas'), {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                {
                    label: `${driver1.code} Speed (km/h)`,
                    data: driver1.data.speed,
                    borderColor: driver1.color,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: `${driver2.code} Speed (km/h)`,
                    data: driver2.data.speed,
                    borderColor: driver2.color,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time (seconds)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Speed (km/h)'
                    },
                    min: 0
                }
            }
        }
    });
    
    // Throttle/Brake comparison chart
    throttleBrakeComparisonChart = new Chart(throttleBrakeChartContainer.querySelector('canvas'), {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                {
                    label: `${driver1.code} Throttle (%)`,
                    data: driver1.data.throttle,
                    borderColor: driver1.color,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.1,
                    yAxisID: 'y'
                },
                {
                    label: `${driver2.code} Throttle (%)`,
                    data: driver2.data.throttle,
                    borderColor: driver2.color,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.1,
                    yAxisID: 'y',
                    borderDash: [5, 5]
                },
                {
                    label: `${driver1.code} Brake (%)`,
                    data: driver1.data.brake,
                    borderColor: '#ff3333',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.1,
                    yAxisID: 'y'
                },
                {
                    label: `${driver2.code} Brake (%)`,
                    data: driver2.data.brake,
                    borderColor: '#ff9999',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.1,
                    yAxisID: 'y',
                    borderDash: [5, 5]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time (seconds)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Percentage (%)'
                    },
                    min: 0,
                    max: 100
                }
            }
        }
    });
    
    // Gear comparison chart
    gearComparisonChart = new Chart(gearChartContainer.querySelector('canvas'), {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                {
                    label: `${driver1.code} Gear`,
                    data: driver1.data.gear,
                    borderColor: driver1.color,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    stepped: true
                },
                {
                    label: `${driver2.code} Gear`,
                    data: driver2.data.gear,
                    borderColor: driver2.color,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    stepped: true,
                    borderDash: [5, 5]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time (seconds)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Gear'
                    },
                    min: 0,
                    max: 8,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
