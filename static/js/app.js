import F1DashAPI from './api.js';
import TrackVisualizer from './track.js';
import { TEAM_COLORS } from './api.js';
import Auth from './auth.js';
import Profile, { FALLBACK_DRIVERS, FALLBACK_TEAMS } from './profile.js';

// Expose globally so legacy code/templates can resolve colors
window.getDriverColor = (driverCode, teamName) => {
    if (!teamName) return '#E10600';
    return TEAM_COLORS[teamName.trim()] || '#E10600';
};

// Driver code to car number mapping
const DRIVER_NUMBERS = {
    VER: 33, PER: 11, HAM: 44, RUS: 63, LEC: 16, SAI: 55,
    NOR: 1, PIA: 81, ALO: 14, STR: 18, GAS: 10, OCO: 31,
    TSU: 22, RIC: 3, BOT: 77, ZHO: 24, MAG: 20, HUL: 27,
    ALB: 23, SAR: 2, LAW: 40, DEV: 45, BEA: 87, COL: 43,
    DOO: 61, HAD: 98, BOR: 38, ANT: 55, DRU: 34, BER: 33,
    VET: 5, MSC: 47, LAT: 6, RAI: 7
};

// Parse pandas Timedelta string (e.g. "0 days 00:00:25.123000") to seconds
function parseSectorTime(str) {
    if (!str) return 0;
    // Try plain numeric first
    const num = parseFloat(str);
    if (!isNaN(num) && !str.includes(':')) return num;
    // Parse "0 days HH:MM:SS.ffffff"
    const match = str.match(/(\d+):(\d+):([\d.]+)/);
    if (match) {
        return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
    }
    return 0;
}

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
    if (!teamName) return '#E10600';
    const color = TEAM_COLORS[teamName.trim()] || '#E10600';
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

// Last fetched standings (used by comparison meta card)
let _lastStandings = [];

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

// ─── Chart.js Dark Theme Defaults ──────────────────────────────────────────
Chart.defaults.color = '#909098';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
Chart.defaults.font.size = 11;
Chart.defaults.plugins.legend.display = false;
Chart.defaults.elements.line.borderWidth = 1.5;
Chart.defaults.elements.point.radius = 0;
Chart.defaults.animation.duration = 600;

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

// Driver code → { slug, year } mapping for F1 CDN photos
// URL format: https://media.formula1.com/image/upload/f_auto/q_auto/v1706188352/content/dam/fom-website/drivers/{year}Drivers/{slug}.png
const _DRIVER_PHOTO = {
    VER: { slug:'verstappen',  year:2024 }, LAW: { slug:'lawson',      year:2025 },
    LEC: { slug:'leclerc',     year:2024 }, HAM: { slug:'hamilton',    year:2025 },
    RUS: { slug:'russell',     year:2024 }, ANT: { slug:'antonelli',   year:2025 },
    NOR: { slug:'norris',      year:2024 }, PIA: { slug:'piastri',     year:2024 },
    ALO: { slug:'alonso',      year:2024 }, STR: { slug:'stroll',      year:2024 },
    GAS: { slug:'gasly',       year:2024 }, DOO: { slug:'doohan',      year:2025 },
    BEA: { slug:'bearman',     year:2024 }, OCO: { slug:'ocon',        year:2024 },
    ALB: { slug:'albon',       year:2024 }, SAI: { slug:'sainz',       year:2025 },
    LIN: { slug:'lindblad',    year:2025 }, HAD: { slug:'hadjar',      year:2025 },
    HUL: { slug:'hulkenberg',  year:2024 }, BOR: { slug:'bortoleto',   year:2025 },
};

const _F1_CDN = 'https://media.formula1.com/image/upload/f_auto/q_auto/v1706188352/content/dam/fom-website/drivers';

function _driverPhotoUrl(name, code) {
    const entry = _DRIVER_PHOTO[code];
    if (entry) return `${_F1_CDN}/${entry.year}Drivers/${entry.slug}.png`;
    // Fallback: derive slug from name
    const slug = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '');
    return `${_F1_CDN}/2024Drivers/${slug}.png`;
}

function _setAvatarPhoto(el, driver, color) {
    const code = driver.code || (driver.name ? driver.name.slice(0, 2).toUpperCase() : 'F1');
    const bg = color ? `${color}22` : 'rgba(225,6,0,0.15)';
    const border = color ? `${color}66` : 'rgba(225,6,0,0.3)';
    el.style.background = bg;
    el.style.borderColor = border;
    el.style.padding = '0';
    el.style.overflow = 'hidden';

    if (driver.name) {
        el.innerHTML = `
            <img src="${_driverPhotoUrl(driver.name, driver.code)}" alt="${driver.name}"
                 style="width:100%;height:100%;object-fit:cover;object-position:top center;"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <span style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:0.75em;font-weight:700;letter-spacing:0.05em">${code}</span>
        `;
    } else {
        el.innerHTML = `<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-size:0.75em;font-weight:700;">${code}</span>`;
    }
}

function updateDriverCard(type, driver) {
    const isPrimary = type === 'primary';
    const nameEl = isPrimary ? primaryDriverName : compareDriverName;
    const teamEl = isPrimary ? primaryDriverTeam : compareDriverTeam;
    const avatarEl = isPrimary ? primaryDriverAvatar : compareDriverAvatar;
    const numEl = document.getElementById(isPrimary ? 'primary-driver-number' : 'compare-driver-number');

    if (!nameEl || !teamEl || !avatarEl) return;

    if (!driver) {
        nameEl.textContent = isPrimary ? 'Select a driver' : 'Optional';
        teamEl.textContent = '—';
        avatarEl.innerHTML = `<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-size:0.75em;font-weight:700;">${isPrimary ? 'P1' : 'C2'}</span>`;
        avatarEl.style.background = 'rgba(225, 6, 0, 0.15)';
        avatarEl.style.borderColor = 'rgba(225, 6, 0, 0.3)';
        if (numEl) numEl.textContent = '—';
        return;
    }

    nameEl.textContent = driver.name || driver.code || 'Unknown';
    teamEl.textContent = driver.team || '—';
    _setAvatarPhoto(avatarEl, driver, driver.color);

    if (numEl && driver.code) {
        const num = DRIVER_NUMBERS[driver.code];
        numEl.textContent = num !== undefined ? num : '—';
        if (driver.color) {
            numEl.style.color = driver.color;
            numEl.style.textShadow = `0 0 20px ${driver.color}66`;
        }
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

function _driverPosition(code) {
    const entry = _lastStandings.find(s => (s.driver || s.code) === code);
    return entry ? `P${entry.position}` : '';
}

function updateComparisonMeta(cmp) {
    const n1 = document.getElementById('meta-name-1');
    const t1 = document.getElementById('meta-team-1');
    const a1 = document.getElementById('meta-avatar-1');
    const n2 = document.getElementById('meta-name-2');
    const t2 = document.getElementById('meta-team-2');
    const a2 = document.getElementById('meta-avatar-2');
    if (!n1 || !n2) return;

    const d1 = cmp.driver1, d2 = cmp.driver2, delta = cmp.delta;
    const pos1 = _driverPosition(d1.code);
    const pos2 = _driverPosition(d2.code);

    n1.textContent = `${d1.code} — Lap ${d1.lap}`;
    const lt1 = d1.lapTime && d1.lapTime !== 'N/A' ? d1.lapTime : '';
    t1.textContent = [pos1, lt1, d1.team].filter(Boolean).join(' · ');
    _setAvatarPhoto(a1, d1, d1.color);

    n2.textContent = `${d2.code} — Lap ${d2.lap}`;
    const lt2 = d2.lapTime && d2.lapTime !== 'N/A' ? d2.lapTime : '';
    t2.textContent = [pos2, lt2, d2.team].filter(Boolean).join(' · ');
    _setAvatarPhoto(a2, d2, d2.color);

    const vsEl = document.querySelector('.vs-divider');
    if (vsEl && delta && delta.time != null) {
        const dt = delta.time;
        const faster = dt < 0 ? d1.code : d2.code;
        vsEl.textContent = `${faster} +${Math.abs(dt).toFixed(3)}s`;
    }
}

function updateTrackLegend(driver1Info, driver2Info) {
    const legend = document.getElementById('track-legend');
    if (!legend) return;

    if (!driver1Info && !driver2Info) {
        legend.classList.remove('visible');
        legend.innerHTML = '';
        return;
    }

    legend.innerHTML = '';
    const makeItem = (info) => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        const num = DRIVER_NUMBERS[info.code];
        item.innerHTML =
            `<span class="legend-swatch" style="background:${info.color || '#888'}"></span>` +
            (num !== undefined ? `<span class="legend-number">#${num}</span>` : '') +
            `<span class="legend-code">${info.code}</span>` +
            `<span class="legend-team">${info.team || ''}</span>`;
        return item;
    };

    if (driver1Info) legend.appendChild(makeItem(driver1Info));
    if (driver2Info) legend.appendChild(makeItem(driver2Info));
    legend.classList.add('visible');
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

const TEAM_COLOR_MAP = {
    'Red Bull Racing': '#3671C6', 'Red Bull': '#3671C6',
    'Ferrari': '#F91536', 'Scuderia Ferrari': '#F91536',
    'Mercedes': '#6CD3BF', 'McLaren': '#FF8000',
    'Aston Martin': '#358C75', 'Alpine': '#FF87BC',
    'AlphaTauri': '#5E8FAA', 'RB': '#5E8FAA',
    'Haas F1 Team': '#B6BABD', 'Haas': '#B6BABD',
    'Williams': '#64C4FF', 'Alfa Romeo': '#C92D4B',
    'Kick Sauber': '#00CF46', 'Audi': '#B3B4B4',
};

function renderStandingsRows(positions) {
    if (!standingsList || !positions || positions.length === 0) return;
    standingsList.innerHTML = '';
    positions
        .sort((a, b) => (a.position || 99) - (b.position || 99))
        .slice(0, 20)
        .forEach((item) => {
            const row = document.createElement('div');
            row.className = 'standing-row';
            const driverCode = item.driver || item.code || '';
            const label = item.lap_time && item.lap_time !== 'N/A' && item.lap_time !== '—'
                ? item.lap_time
                : (item.gap != null ? `+${Number(item.gap).toFixed(3)}` : '—');
            const posClass = item.position <= 3 ? 'standing-position top3' : 'standing-position';
            const color = TEAM_COLOR_MAP[item.team] || '#B6BABD';
            row.innerHTML = `
                <span class="${posClass}">${item.position || '—'}</span>
                <span class="team-stripe" style="background:${color}"></span>
                <span class="standing-name">${driverCode || '—'}</span>
                <span class="standing-gap">${label}</span>
            `;

            row.dataset.driver = driverCode;
            row.addEventListener('click', () => {
                // Highlight clicked row
                standingsList.querySelectorAll('.standing-row').forEach(r => r.classList.remove('active'));
                row.classList.add('active');
                selectDriverFromStandings(driverCode);
            });
            standingsList.appendChild(row);
        });
}

async function selectDriverFromStandings(code) {
    if (!code || !seasonSelect.value || !raceSelect.value || !sessionSelect.value) return;

    const match = Array.from(driverSelect.options).find(o => o.value === code);
    if (!match) return;

    const currentLap = lapSelect.value;

    driverSelect.value = code;
    driverSelect.dispatchEvent(new Event('change'));

    // Wait for laps to finish populating
    await new Promise(resolve => {
        const check = () => (lapSelect.options.length > 1) ? resolve() : setTimeout(check, 100);
        setTimeout(check, 200);
    });

    // Re-select the same lap that was showing in standings
    if (currentLap && Array.from(lapSelect.options).some(o => o.value === currentLap)) {
        lapSelect.value = currentLap;
    } else if (lapSelect.options.length > 1) {
        lapSelect.value = lapSelect.options[1].value;
    }
    lapSelect.dispatchEvent(new Event('change'));

    loadButton.click();
}

async function refreshStandings() {
    if (!lapSelect.value || !seasonSelect.value || !raceSelect.value || !sessionSelect.value) return;

    if (standingsList) {
        standingsList.innerHTML = '<div style="text-align:center;opacity:0.4;padding:12px;font-size:12px;">Loading standings…</div>';
    }

    try {
        const url = `/api/standings/${seasonSelect.value}/${raceSelect.value}/${sessionSelect.value}/${lapSelect.value}`;
        console.log('[Standings] GET', url);
        const resp = await axios.get(url);
        const positions = resp.data;
        console.log('[Standings] received', positions?.length, 'rows');
        if (positions && positions.length > 0) {
            _lastStandings = positions;
            renderStandingsRows(positions);
        } else {
            _lastStandings = [];
            if (standingsList) standingsList.innerHTML = '';
        }
    } catch (err) {
        console.error('[Standings] Error:', err.response?.status, err.response?.data || err.message);
        if (standingsList) standingsList.innerHTML = '';
    }
}

function setupStandings() {
    if (!standingsList) return;
    standingsList.innerHTML = '';

    // WebSocket for live sessions (best-effort)
    try {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const socket = new WebSocket(`${protocol}://${window.location.host}/api/ws/positions`);
        socket.onmessage = (event) => {
            try {
                // Only drive the standings via WebSocket when no lap is selected yet
                if (lapSelect.value) return;
                const positions = JSON.parse(event.data);
                if (Array.isArray(positions) && positions.length > 0) renderStandingsRows(positions);
            } catch (e) {
                console.warn('Live standings parse error', e);
            }
        };
    } catch (e) {
        console.warn('Standings websocket unavailable', e);
    }
}

function populateStandings(drivers) {
    if (!standingsList || !drivers || drivers.length === 0) return;
    const positions = drivers.map((d, i) => ({
        position: i + 1,
        driver: d.name || d.code,
        code: d.code,
        team: d.team,
        gap: null
    }));
    renderStandingsRows(positions);
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
            
            // Sort races chronologically by round number
            races.sort((a, b) => a.round - b.round);

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

            // Unlock comparison card
            const compCard = document.getElementById('comparison-driver-card');
            if (compCard) compCard.classList.remove('locked');

            // Populate standings from session drivers
            populateStandings(drivers);

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
            
            // Populate lap select — just lap numbers
            laps.forEach(lap => {
                const option = document.createElement('option');
                option.value = lap.lap;
                option.textContent = `Lap ${lap.lap}`;
                option.dataset.s1 = lap.sector1 || '';
                option.dataset.s2 = lap.sector2 || '';
                option.dataset.s3 = lap.sector3 || '';
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
    lapSelect.addEventListener('change', async () => {
        loadButton.disabled = !lapSelect.value;
        if (!lapSelect.value) return;
        await refreshStandings();
    });
    
    // Compare driver select
    compareDriverSelect.addEventListener('change', () => {
        if (!compareDriverSelect.value) {
            updateDriverCard('compare', null);
            return;
        }

        // Prevent selecting the same driver
        if (compareDriverSelect.value === driverSelect.value) {
            alert("Please select a different driver for comparison");
            compareDriverSelect.value = "";
            return;
        }

        const selectedOption = compareDriverSelect.options[compareDriverSelect.selectedIndex];
        updateDriverCard('compare', {
            code: compareDriverSelect.value,
            name: selectedOption.dataset.name,
            team: selectedOption.dataset.team,
            color: selectedOption.dataset.color
        });
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
            const driverColor = driverOption.dataset.color || getTeamColor(driverTeam);
            
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
            
            // Show loading state in chart containers
            speedChartContainer.innerHTML = '<div class="loading-placeholder">Processing telemetry... (may take ~15s if no DB index)</div>';
            throttleBrakeChartContainer.innerHTML = '<div class="loading-placeholder">Processing throttle/brake...</div>';
            gearChartContainer.innerHTML = '<div class="loading-placeholder">Processing gear shifts...</div>';

            // Load telemetry data for primary driver
            const telemetry = await F1DashAPI.getTelemetry(
                seasonSelect.value,
                raceSelect.value,
                sessionSelect.value,
                driverSelect.value,
                lapSelect.value
            );
            
            debug("Telemetry loaded points", telemetry.length);
            
            // If comparison driver is selected, use the same lap for both
            if (compareDriverSelect.value) {
                debug("Starting comparison mode", {
                    driver1: driverSelect.value,
                    lap: lapSelect.value,
                    driver2: compareDriverSelect.value
                });
                
                // Get comparison driver's team and color
                const compareDriverOption = compareDriverSelect.options[compareDriverSelect.selectedIndex];
                const compareDriverTeam = compareDriverOption.dataset.team || 
                    extractTeamName(compareDriverOption.textContent);
                const compareDriverColor = compareDriverOption.dataset.color || getTeamColor(compareDriverTeam);
                
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
                        lapSelect.value
                    );
                    
                    debug("Comparison data loaded", {
                        driver1: comparisonData.driver1.code,
                        driver2: comparisonData.driver2.code,
                        delta: comparisonData.delta
                    });
                    
                    // Use dropdown colors as fallback only — backend colors take priority
                    if (!comparisonData.driver1.color) comparisonData.driver1.color = driverColor || '#e10600';
                    if (!comparisonData.driver2.color) comparisonData.driver2.color = compareDriverColor || '#3671C6';

                    // Sector times come from the backend (already in comparisonData.driver1.sectors / .driver2.sectors)
                    // Do NOT overwrite them here — the backend computes them from FastF1 laps directly.

                    // Update track visualization — setComparisonData will also inject
                    // comparisonData.sector_boundaries into the track if present.
                    trackVisualizer.setComparisonData(comparisonData);

                    // Update the HTML track legend
                    updateTrackLegend(
                        { code: comparisonData.driver1.code, color: comparisonData.driver1.color, team: comparisonData.driver1.team },
                        { code: comparisonData.driver2.code, color: comparisonData.driver2.color, team: comparisonData.driver2.team }
                    );

                    // Render comparison charts
                    renderComparisonCharts(comparisonData);

                    // Update the right-panel comparison meta card
                    updateComparisonMeta(comparisonData);

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
                updateTrackLegend(
                    { code: driverSelect.value, color: driverColor, team: driverTeam },
                    null
                );
                
                const avgSpeed = telemetry.reduce((sum, point) => sum + point.speed, 0) / (telemetry.length || 1);
                const maxSpeed = Math.max(...telemetry.map(point => point.speed));
                updateInsights([
                    `${driverSelect.value} avg speed ${avgSpeed.toFixed(1)} km/h`,
                    `Peak speed ${maxSpeed.toFixed(1)} km/h`,
                    `Lap ${lapSelect.value} loaded with ${telemetry.length} samples`
                ]);

                setStatus('Telemetry data loaded', false);
            }

            // Always refresh standings after loading data
            refreshStandings();
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
        loadButton.disabled = true;
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
    
    speedChartContainer.innerHTML = '<div class="loading-placeholder">Select data to display speed chart</div>';
    throttleBrakeChartContainer.innerHTML = '<div class="loading-placeholder">Select data to display throttle/brake chart</div>';
    gearChartContainer.innerHTML = '<div class="loading-placeholder">Gear data</div>';
}

// Render charts with telemetry data
function renderCharts(telemetry, driverCode, driverColor) {
    // Clear existing charts
    clearCharts();
    
    debug("Rendering single driver charts", {driverCode, driverColor});
    
    // Format telemetry data for charts (ensure time is a float)
    const labels = telemetry.map(data => {
        const t = parseFloat(data.time);
        return isNaN(t) ? '0' : t.toFixed(1);
    });
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
    
    // Prepare comparison data
    const timeLabels = driver1.data.time.map(t => {
        const v = parseFloat(t);
        return isNaN(v) ? '0' : v.toFixed(1);
    });
    
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

// =========================================================================
// ONBOARDING TUTORIAL
// =========================================================================
const TUTORIAL_STEPS = [
    {
        type: 'welcome',
        title: 'Welcome to F1 Core',
        body: 'Your personal Formula 1 telemetry and race analytics dashboard — built for every fan, from casual to hardcore.',
        features: [
            { icon: 'fa-solid fa-gauge-high', text: 'Real telemetry data from every F1 session since 2018' },
            { icon: 'fa-solid fa-code-compare', text: 'Head-to-head driver comparison with color-coded track maps' },
            { icon: 'fa-solid fa-ranking-star', text: 'Lap-by-lap standings that update as you explore' },
            { icon: 'fa-solid fa-hand-pointer', text: 'Click any driver in standings to instantly load their data' },
        ],
    },
    {
        target: '.sidebar',
        title: 'Navigation Sidebar',
        body: 'This is your main navigation hub. Switch between the <strong>Telemetry</strong> view for race data analysis and <strong>News & Insights</strong> for the latest F1 updates.',
        tip: 'On mobile, tap the hamburger menu icon to open the sidebar.',
        position: 'right',
    },
    {
        target: '#primary-driver-card',
        title: 'Select Your Race Weekend',
        body: 'Start here. The four dropdowns cascade — pick a <strong>Season</strong>, then a <strong>Grand Prix</strong> unlocks, then <strong>Session</strong> (Race, Qualifying, Practice), and finally a <strong>Driver</strong>. Each step unlocks the next automatically.',
        tip: 'Data is available from 2018 to the latest completed race weekend.',
        position: 'right',
    },
    {
        target: '#comparison-driver-card',
        title: 'Add a Comparison Driver',
        body: 'This is where the magic happens. Once you\'ve picked a primary driver above, select a <strong>second driver</strong> here to see a full head-to-head comparison. The track, charts, and delta timings all update to show who\'s faster and where.',
        tip: 'This card unlocks automatically once you select your primary driver.',
        position: 'right',
    },
    {
        target: '#lap-select',
        title: 'Choose a Lap',
        body: 'Select which lap to analyse. All telemetry data and standings will correspond to this specific lap. Change laps to see how the race evolved turn by turn.',
        tip: 'Standings on the right update in real-time when you switch laps.',
        position: 'right',
    },
    {
        target: '#load-data',
        title: 'Load Telemetry Data',
        body: 'Once your selections are made, hit this button to fetch real F1 telemetry. The system pulls data from FastF1\'s official timing feeds — speed, throttle, brake, gear, and GPS position are all included.',
        tip: 'First loads may take ~10-15 seconds. Repeat requests are cached and near-instant.',
        position: 'right',
    },
    {
        target: '.track-card',
        title: 'Interactive Track Map',
        body: 'The full circuit layout is rendered using real GPS coordinates. In comparison mode, <strong>every point on the track is color-coded</strong> based on who\'s faster at that exact position.',
        tip: 'Hover anywhere on the track to see both drivers\' speed and the time delta at that point.',
        position: 'bottom',
    },
    {
        target: '.charts-container',
        title: 'Telemetry Trace Charts',
        body: 'Three detailed charts show the full telemetry picture:<br><strong>Speed</strong> — top speed, braking zones, and corner minimum speeds.<br><strong>Throttle & Brake</strong> — pedal inputs showing driving style.<br>In comparison mode, both drivers are overlaid with team colors.',
        position: 'top',
    },
    {
        target: '.standings-card',
        title: 'Lap-by-Lap Race Standings',
        body: 'This panel shows the race order at your selected lap — positions, team colors, and gap to the leader. It updates dynamically as you change laps to let you replay the race.',
        tip: 'Click any driver row to instantly load their telemetry as the primary driver. No need to find them in the dropdown.',
        position: 'left',
    },
    {
        target: '.driver-meta-card',
        title: 'Comparison Summary Card',
        body: 'A quick-glance card showing both drivers side-by-side — their position in the race, lap time, and team. This updates whenever you load a comparison to give you the headline numbers at a glance.',
        position: 'left',
    },
    {
        target: '.right-panel .chart-card',
        title: 'Gear Trace',
        body: 'The gear chart shows what gear each driver is in throughout the lap. Useful for spotting different racing lines — if one driver short-shifts or takes a corner in a higher gear, you\'ll see it here.',
        position: 'left',
    },
    {
        type: 'setup',
        title: 'Personalise Your Experience',
        body: 'Sign in to pick your favourite driver and track their season in My Garage.',
    },
];

class Tutorial {
    constructor() {
        this._step = 0;
        this._overlay = null;
        this._card = null;
        this._spotlight = null;
        this._arrow = null;
        this._onKey = this._handleKey.bind(this);
    }

    shouldShow() {
        return !localStorage.getItem('f1dash_tutorial_done');
    }

    start() {
        if (this._overlay) return;
        this._buildDOM();
        document.addEventListener('keydown', this._onKey);
        requestAnimationFrame(() => this._show(0));
    }

    _buildDOM() {
        this._overlay = document.createElement('div');
        this._overlay.className = 'tutorial-overlay';
        this._overlay.innerHTML = '<div class="tutorial-backdrop"></div>';

        this._spotlight = document.createElement('div');
        this._spotlight.className = 'tutorial-spotlight';
        this._overlay.appendChild(this._spotlight);

        this._arrow = document.createElement('div');
        this._arrow.className = 'tutorial-arrow';
        this._overlay.appendChild(this._arrow);

        this._card = document.createElement('div');
        this._card.className = 'tutorial-card';
        this._overlay.appendChild(this._card);

        document.body.appendChild(this._overlay);
        requestAnimationFrame(() => this._overlay.classList.add('active'));
    }

    _clearHighlight() {
        const prev = document.querySelector('.tutorial-highlight');
        if (prev) prev.classList.remove('tutorial-highlight');
    }

    _show(idx) {
        // Fade card out, update, fade back in — prevents glitch from animation reset
        // Don't shift transform on welcome/setup cards (they use translate(-50%,-50%) !important)
        const step = TUTORIAL_STEPS[idx];
        const isCentered = step?.type === 'welcome' || step?.type === 'setup';
        this._card.style.opacity = '0';
        if (!isCentered) this._card.style.transform = 'translateY(6px)';
        clearTimeout(this._fadeTimer);
        this._fadeTimer = setTimeout(() => {
            this._showContent(idx);
            this._card.style.opacity = '1';
            this._card.style.transform = '';
        }, 160);
    }

    _showContent(idx) {
        this._clearHighlight();
        this._step = idx;
        const step = TUTORIAL_STEPS[idx];
        const total = TUTORIAL_STEPS.length;
        const realSteps = total - 2; // exclude welcome & setup

        const dots = Array.from({ length: total }, (_, i) => {
            const cls = i < idx ? 'done' : i === idx ? 'active' : '';
            return `<div class="tutorial-progress-dot ${cls}"></div>`;
        }).join('');

        if (step.type === 'welcome') {
            this._spotlight.style.display = 'none';
            this._arrow.style.display = 'none';
            this._card.className = 'tutorial-card welcome';

            const featureHTML = (step.features || []).map(f =>
                `<div class="tutorial-feature-item"><i class="${f.icon}"></i><span>${f.text}</span></div>`
            ).join('');

            this._card.innerHTML = `
                <div class="tutorial-welcome-icon"><i class="fa-solid fa-flag-checkered"></i></div>
                <h3>${step.title}</h3>
                <p class="tutorial-welcome-sub">${step.body}</p>
                <div class="tutorial-features">${featureHTML}</div>
                <div class="tutorial-progress">${dots}</div>
                <div class="tutorial-actions">
                    <button class="tutorial-btn tutorial-btn-skip" data-action="skip">Skip Tour</button>
                    <button class="tutorial-btn tutorial-btn-next" data-action="next">Start Tour <i class="fa-solid fa-arrow-right" style="margin-left:6px;font-size:11px;"></i></button>
                </div>
                <div class="tutorial-key-hint">Navigate: <kbd>&larr;</kbd> <kbd>&rarr;</kbd> arrow keys &middot; <kbd>Esc</kbd> to skip</div>
            `;
        } else if (step.type === 'setup') {
            this._spotlight.style.display = 'none';
            this._arrow.style.display = 'none';
            this._card.className = 'tutorial-card welcome';

            const profile = window.userProfile;
            const isAuth = Auth.isAuthenticated;
            const hasDriver = profile && !profile.is_guest && profile.favorite_driver_code;
            const favDriver = hasDriver ? FALLBACK_DRIVERS.find(d => d.code === profile.favorite_driver_code) : null;

            let innerHTML = '';
            if (!isAuth) {
                // Not signed in
                innerHTML = `
                    <div class="tutorial-welcome-icon"><i class="fa-solid fa-user-circle"></i></div>
                    <h3>${step.title}</h3>
                    <p class="tutorial-welcome-sub">${step.body}</p>
                    <div class="tutorial-progress">${dots}</div>
                    <div class="tutorial-actions" style="flex-direction:column;gap:10px;align-items:stretch;">
                        <button class="tutorial-btn tutorial-btn-next" data-action="signin" style="width:100%;justify-content:center;">
                            <i class="fa-solid fa-right-to-bracket" style="margin-right:8px;"></i> Sign In
                        </button>
                        <button class="tutorial-btn tutorial-btn-skip" data-action="next" style="width:100%;justify-content:center;text-align:center;">
                            Skip for now — explore as guest
                        </button>
                    </div>
                    <div style="display:flex;justify-content:flex-start;margin-top:8px;">
                        <button class="tutorial-btn tutorial-btn-back" data-action="back"><i class="fa-solid fa-arrow-left" style="margin-right:6px;font-size:11px;"></i>Back</button>
                    </div>
                `;
            } else if (!hasDriver) {
                // Signed in but no driver
                const topDrivers = FALLBACK_DRIVERS.slice(0, 6);
                const driverCards = topDrivers.map(d => {
                    const color = TEAM_COLORS[d.team] || '#E10600';
                    return `<div class="tut-driver-chip" data-code="${d.code}" style="--chip-color:${color}">
                        <span class="tdc-code">${d.code}</span>
                        <span class="tdc-name">${d.name.split(' ').pop()}</span>
                    </div>`;
                }).join('');
                innerHTML = `
                    <div class="tutorial-welcome-icon" style="background:rgba(225,6,0,0.15);"><i class="fa-solid fa-flag-checkered"></i></div>
                    <h3>Pick Your Driver</h3>
                    <p class="tutorial-welcome-sub">Who are you rooting for this season?</p>
                    <div class="tut-driver-grid" id="tut-driver-grid">${driverCards}</div>
                    <div class="tutorial-progress">${dots}</div>
                    <div class="tutorial-actions">
                        <button class="tutorial-btn tutorial-btn-back" data-action="back"><i class="fa-solid fa-arrow-left" style="margin-right:6px;font-size:11px;"></i>Back</button>
                        <button class="tutorial-btn tutorial-btn-next" data-action="next">Skip <i class="fa-solid fa-arrow-right" style="margin-left:6px;font-size:11px;"></i></button>
                    </div>
                `;
            } else {
                // Signed in + has driver
                const color = TEAM_COLORS[favDriver?.team] || '#E10600';
                innerHTML = `
                    <div class="tutorial-welcome-icon" style="background:var(--green);box-shadow:0 0 40px var(--green-glow);"><i class="fa-solid fa-check"></i></div>
                    <h3>You're All Set!</h3>
                    <p class="tutorial-welcome-sub">Following <strong style="color:${color}">${favDriver?.name || profile.favorite_driver_code}</strong> — head to My Garage to track their season.</p>
                    <div class="tutorial-progress">${dots}</div>
                    <div class="tutorial-actions">
                        <button class="tutorial-btn tutorial-btn-back" data-action="back"><i class="fa-solid fa-arrow-left" style="margin-right:6px;font-size:11px;"></i>Back</button>
                        <button class="tutorial-btn tutorial-btn-next" data-action="next" style="background:var(--green);box-shadow:0 0 20px var(--green-glow);">Get Started <i class="fa-solid fa-rocket" style="margin-left:6px;font-size:11px;"></i></button>
                    </div>
                `;
            }
            this._card.innerHTML = innerHTML;

            // Wire driver chips
            this._card.querySelectorAll('.tut-driver-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    this._card.querySelectorAll('.tut-driver-chip').forEach(c => c.classList.remove('selected'));
                    chip.classList.add('selected');
                    const code = chip.dataset.code;
                    const driver = FALLBACK_DRIVERS.find(d => d.code === code);
                    // Optimistic update — profile:updated + garage will read this immediately
                    window.userProfile = {
                        ...(window.userProfile || {}),
                        favorite_driver_code: code,
                        favorite_team_id: driver?.team || null,
                        onboarding_complete: true,
                    };
                    Profile.savePreferences({ driverCode: code, teamId: driver?.team || null, complete: true })
                        .catch(e => console.warn('[Tutorial] savePreferences failed silently', e));
                    window.dispatchEvent(new CustomEvent('profile:updated'));
                    // Re-render this step to show the "all set" state
                    setTimeout(() => this._show(idx), 300);
                });
            });
        } else {
            this._spotlight.style.display = '';
            this._arrow.style.display = '';
            this._card.className = 'tutorial-card';

            const stepNum = idx;
            const tipHTML = step.tip
                ? `<div class="tutorial-tip"><i class="fa-solid fa-lightbulb"></i><span>${step.tip}</span></div>`
                : '';

            this._card.innerHTML = `
                <div class="tutorial-step-badge"><i class="fa-solid fa-location-dot"></i> Step ${stepNum} of ${realSteps}</div>
                <h3>${step.title}</h3>
                <p>${step.body}</p>
                ${tipHTML}
                <div class="tutorial-progress">${dots}</div>
                <div class="tutorial-actions">
                    <div>
                        ${idx > 1 ? '<button class="tutorial-btn tutorial-btn-back" data-action="back"><i class="fa-solid fa-arrow-left" style="margin-right:6px;font-size:11px;"></i>Back</button>' : ''}
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <button class="tutorial-btn tutorial-btn-skip" data-action="skip">Skip</button>
                        <button class="tutorial-btn tutorial-btn-next" data-action="next">Next <i class="fa-solid fa-arrow-right" style="margin-left:6px;font-size:11px;"></i></button>
                    </div>
                </div>
            `;

            this._positionSpotlight(step);
        }

        this._card.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => this._onAction(btn.dataset.action));
        });
    }

    _positionSpotlight(step) {
        const el = document.querySelector(step.target);
        if (!el) {
            this._spotlight.style.display = 'none';
            this._arrow.style.display = 'none';
            this._card.style.top = '50%';
            this._card.style.left = '50%';
            this._card.style.transform = 'translate(-50%,-50%)';
            return;
        }

        el.classList.add('tutorial-highlight');
        const r = el.getBoundingClientRect();
        const pad = 12;
        this._spotlight.style.top = `${r.top - pad}px`;
        this._spotlight.style.left = `${r.left - pad}px`;
        this._spotlight.style.width = `${r.width + pad * 2}px`;
        this._spotlight.style.height = `${r.height + pad * 2}px`;

        const cardW = 380;
        const gap = 24;
        let top, left;

        switch (step.position) {
            case 'right':
                top = r.top + r.height / 2 - 120;
                left = r.right + gap + pad;
                if (left + cardW > window.innerWidth - 16) {
                    left = r.left - cardW - gap - pad;
                }
                break;
            case 'left':
                top = r.top + r.height / 2 - 120;
                left = r.left - cardW - gap - pad;
                if (left < 16) left = r.right + gap + pad;
                break;
            case 'bottom':
                top = r.bottom + gap + pad;
                left = r.left + r.width / 2 - cardW / 2;
                break;
            case 'top': {
                const cardH = this._card.offsetHeight || 280;
                top = r.top - cardH - gap - pad;
                left = r.left + r.width / 2 - cardW / 2;
                break;
            }
            default:
                top = r.bottom + gap;
                left = r.left;
        }

        const cardH = this._card.offsetHeight || 280;
        top = Math.max(12, Math.min(top, window.innerHeight - cardH - 12));
        left = Math.max(12, Math.min(left, window.innerWidth - cardW - 12));

        this._card.style.top = `${top}px`;
        this._card.style.left = `${left}px`;
        this._card.style.transform = 'none';

        this._positionArrow(step.position, r, pad, { top, left, w: cardW, h: cardH });
    }

    _positionArrow(pos, targetRect, pad, card) {
        const a = this._arrow;
        if (!a) return;
        a.style.display = '';
        a.style.width = '0';
        a.style.height = '0';

        const spotMidX = targetRect.left + targetRect.width / 2;
        const spotMidY = targetRect.top + targetRect.height / 2;
        const cardMidY = card.top + card.h / 2;
        const cardMidX = card.left + card.w / 2;

        switch (pos) {
            case 'right': {
                const x1 = targetRect.right + pad + 4;
                const x2 = card.left - 4;
                const y = Math.min(spotMidY, card.top + card.h - 20);
                a.style.left = `${x1}px`;
                a.style.top = `${y}px`;
                a.style.width = `${Math.max(0, x2 - x1)}px`;
                a.style.height = '2px';
                a.style.background = 'linear-gradient(90deg, rgba(225,6,0,0.7), rgba(225,6,0,0.15))';
                break;
            }
            case 'left': {
                const x1 = card.left + card.w + 4;
                const x2 = targetRect.left - pad - 4;
                const y = Math.min(spotMidY, card.top + card.h - 20);
                a.style.left = `${x1}px`;
                a.style.top = `${y}px`;
                a.style.width = `${Math.max(0, x2 - x1)}px`;
                a.style.height = '2px';
                a.style.background = 'linear-gradient(90deg, rgba(225,6,0,0.15), rgba(225,6,0,0.7))';
                break;
            }
            case 'bottom': {
                const y1 = targetRect.bottom + pad + 4;
                const y2 = card.top - 4;
                a.style.left = `${spotMidX}px`;
                a.style.top = `${y1}px`;
                a.style.width = '2px';
                a.style.height = `${Math.max(0, y2 - y1)}px`;
                a.style.background = 'linear-gradient(180deg, rgba(225,6,0,0.7), rgba(225,6,0,0.15))';
                break;
            }
            case 'top': {
                const y1 = card.top + card.h + 4;
                const y2 = targetRect.top - pad - 4;
                a.style.left = `${spotMidX}px`;
                a.style.top = `${y1}px`;
                a.style.width = '2px';
                a.style.height = `${Math.max(0, y2 - y1)}px`;
                a.style.background = 'linear-gradient(180deg, rgba(225,6,0,0.15), rgba(225,6,0,0.7))';
                break;
            }
            default:
                a.style.display = 'none';
        }
    }

    _onAction(action) {
        if (action === 'skip') return this._finish();
        if (action === 'signin') { this._finish(); Auth.login(); return; }
        if (action === 'back' && this._step > 0) return this._show(this._step - 1);
        if (action === 'next') {
            if (this._step >= TUTORIAL_STEPS.length - 1) return this._finish();
            this._show(this._step + 1);
        }
    }

    _handleKey(e) {
        if (e.key === 'Escape') this._finish();
        else if (e.key === 'ArrowRight' || e.key === 'Enter') this._onAction('next');
        else if (e.key === 'ArrowLeft') this._onAction('back');
    }

    _finish() {
        this._clearHighlight();
        localStorage.setItem('f1dash_tutorial_done', '1');
        document.removeEventListener('keydown', this._onKey);
        this._overlay.classList.remove('active');
        setTimeout(() => { this._overlay.remove(); this._overlay = null; }, 350);
    }
}

const _tutorial = new Tutorial();

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    await initApp();
    if (_tutorial.shouldShow()) {
        setTimeout(() => _tutorial.start(), 600);
    }
});
