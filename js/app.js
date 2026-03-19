// ============================================================
// NAVIGATION
// ============================================================
const navLinks = document.querySelectorAll('.sidebar .nav-links li[data-target]');
const views = document.querySelectorAll('.view');
const pageTitleEl = document.getElementById('current-page-title');

navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        const targetId = link.getAttribute('data-target');
        views.forEach(view => {
            view.classList.toggle('active', view.id === targetId);
        });
        pageTitleEl.innerText = link.querySelector('span').innerText;
    });
});

// ============================================================
// DROPDOWN ELEMENTS
// ============================================================
const selSeason  = document.getElementById('sel-season');
const selRace    = document.getElementById('sel-race');
const selSession = document.getElementById('sel-session');
const selDriver1 = document.getElementById('sel-driver1');
const selLap1    = document.getElementById('sel-lap1');
const selDriver2 = document.getElementById('sel-driver2');
const selLap2    = document.getElementById('sel-lap2');
const loadBtn    = document.getElementById('btn-load-telemetry');
const statusText = document.getElementById('app-status');

function setStatus(msg, color = '#00e676') {
    statusText.innerText = msg;
    statusText.previousElementSibling.style.backgroundColor = color;
}

// ============================================================
// SELECT HELPERS
// ============================================================
function populateSelect(selectEl, data, placeholder, valueKey, labelKey) {
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
    (data || []).forEach(item => {
        const val = valueKey ? (item[valueKey] ?? item) : item;
        const lbl = labelKey ? (item[labelKey] ?? item) : item;
        selectEl.innerHTML += `<option value="${val}">${lbl}</option>`;
    });
    selectEl.disabled = false;
}

function resetSelects(...selects) {
    selects.forEach(s => {
        const ph = s.options[0]?.text || '';
        s.innerHTML = `<option value="">${ph}</option>`;
        s.disabled = true;
    });
    loadBtn.disabled = true;
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    setStatus('Loading...', '#f58020');

    // Start animated fallback track immediately
    window.ChartEngine.loadDemoData();

    // Load standings
    APIService.initStandingsWebsocket((standings) => {
        const list = document.getElementById('standings-list');
        if (!list) return;
        list.innerHTML = standings.map(st => `
            <li class="standing-item">
                <span class="pos">${st.pos}</span>
                <span class="team-color ${st.team}"></span>
                <span class="name">${st.name}</span>
                <span class="gap">${st.gap}</span>
            </li>
        `).join('');
    });

    // Load seasons
    try {
        const seasons = await APIService.getSeasons();
        populateSelect(selSeason, seasons, 'Season');
        setStatus('Ready');
    } catch (e) {
        setStatus('Connection Error', '#e10600');
    }
});

// ============================================================
// CASCADING DROPDOWNS
// ============================================================

// SEASON → load races
selSeason.addEventListener('change', async () => {
    const year = selSeason.value;
    resetSelects(selRace, selSession, selDriver1, selLap1, selDriver2, selLap2);
    if (!year) return;

    setStatus('Loading races...', '#f58020');
    const races = await APIService.getRaces(year);
    populateSelect(selRace, races, 'Race', 'round', 'name');
    setStatus('Ready');
});

// RACE → load track + sessions
selRace.addEventListener('change', async () => {
    const round = selRace.value;
    resetSelects(selSession, selDriver1, selLap1, selDriver2, selLap2);
    if (!round) return;

    const year = selSeason.value;
    const raceName = selRace.options[selRace.selectedIndex]?.text || '';

    setStatus('Loading track...', '#f58020');

    // ⭐ Fetch the real track for this race from the API
    window.ChartEngine.loadTrackForRace(year, round, raceName, {
        color1: '#3671C6',
        color2: '#F91536',
        label1: 'DRIVER 1',
        label2: 'DRIVER 2',
        showComparison: true
    });

    const sessions = await APIService.getSessions(year, round);
    populateSelect(selSession, sessions, 'Session');
    setStatus('Ready');
});

// SESSION → load drivers
selSession.addEventListener('change', async () => {
    const session = selSession.value;
    resetSelects(selDriver1, selLap1, selDriver2, selLap2);
    if (!session) return;

    setStatus('Loading drivers...', '#f58020');
    const drivers = await APIService.getDrivers(selSeason.value, selRace.value, session);
    populateSelect(selDriver1, drivers, 'Driver', 'code', 'name');
    // pre-populate comparison list too
    const sel2Inner = selDriver2.innerHTML;
    populateSelect(selDriver2, drivers, 'Driver', 'code', 'name');
    selDriver2.disabled = true;
    setStatus('Ready');
});

// PRIMARY DRIVER → load laps
selDriver1.addEventListener('change', async () => {
    const driver = selDriver1.value;
    resetSelects(selLap1, selLap2);
    selDriver2.disabled = true;
    if (!driver) return;

    setStatus('Loading laps...', '#f58020');
    const laps = await APIService.getLaps(selSeason.value, selRace.value, selSession.value, driver);
    populateSelect(selLap1, laps, 'Lap', 'lap', 'lap');
    setStatus('Ready');
});

// LAP 1 → unlock load button + comparison
selLap1.addEventListener('change', () => {
    const hasLap = !!selLap1.value;
    loadBtn.disabled = !hasLap;
    selDriver2.disabled = !hasLap;
    document.querySelector('.driver-card.comparison')?.classList.toggle('locked', !hasLap);
});

// COMPARISON DRIVER → load its laps
selDriver2.addEventListener('change', async () => {
    const driver = selDriver2.value;
    resetSelects(selLap2);
    if (!driver) return;
    const laps = await APIService.getLaps(selSeason.value, selRace.value, selSession.value, driver);
    populateSelect(selLap2, laps, 'Lap', 'lap', 'lap');
});

// ============================================================
// LOAD TELEMETRY
// ============================================================
loadBtn.addEventListener('click', async () => {
    setStatus('Fetching telemetry...', '#f58020');
    window.ChartEngine.initCharts();

    const year    = selSeason.value;
    const round   = selRace.value;
    const session = selSession.value;
    const d1      = selDriver1.value;
    const l1      = selLap1.value;
    const d2      = selDriver2.value;
    const l2      = selLap2.value;
    const isCompare = d2 && l2;

    // Driver colors from team map
    const c1 = window.getDriverColor ? window.getDriverColor(d1) : '#3671C6';
    const c2 = window.getDriverColor ? window.getDriverColor(d2) : '#F91536';

    // Update track driver labels to match selected drivers
    window.ChartEngine.startTrackAnimation('track-canvas', {
        color1: c1, color2: c2,
        label1: d1, label2: isCompare ? d2 : '',
        showComparison: !!isCompare
    });

    try {
        if (isCompare) {
            const compData = await APIService.getComparison(year, round, session, d1, l1, d2, l2);
            // API returns { driver1: { data: {speed[], throttle[], brake[], gear[]} }, driver2: ... }
            const t1 = compData.driver1?.data || compData.telemetry1;
            const t2 = compData.driver2?.data || compData.telemetry2;
            window.ChartEngine.updateCharts(t1, t2, compData.driver1?.color || c1, compData.driver2?.color || c2, d1, d2);
        } else {
            // Single driver: API returns array of { time, speed, throttle, brake, gear, x, y }
            const data = await APIService.getTelemetry(year, round, session, d1, l1);
            window.ChartEngine.updateCharts(data, null, c1, c1, d1);
        }

        setStatus('Telemetry Active');
        statusText.previousElementSibling.style.boxShadow = '0 0 8px rgba(0, 230, 118, 0.5)';
        loadBtn.disabled = true;
        setTimeout(() => loadBtn.disabled = false, 2000);

    } catch (e) {
        console.error(e);
        setStatus('Error', '#e10600');
    }
});
