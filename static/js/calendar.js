/**
 * calendar.js — 2026 F1 Season Calendar with 3D Globe
 *
 * Left panel: interactive globe.gl 3D Earth with race-location pins
 * Right panel: scrollable race card list
 *
 * Interactions:
 *   - Click a race card  → globe flies to that circuit
 *   - Click a globe pin  → card scrolls into view + highlights
 *   - Hover a pin        → tooltip with race name
 */

const RACES_2026 = [
  { round:1,  name:'Australian Grand Prix',    short:'Australia',    circuit:'Albert Park Circuit',               city:'Melbourne',    country:'Australia',    flag:'🇦🇺', date:'2026-03-15', lat:-37.8497, lng:144.9680, km:'5.278', laps:58, turns:16, drs:4, record:'1:20.235', recordBy:'Charles Leclerc',       recordYear:2022, trackKey:'Australia' },
  { round:2,  name:'Chinese Grand Prix',        short:'China',        circuit:'Shanghai International Circuit',    city:'Shanghai',     country:'China',        flag:'🇨🇳', date:'2026-03-22', lat:31.3389,  lng:121.2198, km:'5.451', laps:56, turns:16, drs:2, record:'1:32.238', recordBy:'Michael Schumacher',    recordYear:2004, trackKey:'China' },
  { round:3,  name:'Japanese Grand Prix',       short:'Japan',        circuit:'Suzuka Circuit',                    city:'Suzuka',       country:'Japan',        flag:'🇯🇵', date:'2026-04-05', lat:34.8431,  lng:136.5414, km:'5.807', laps:53, turns:18, drs:1, record:'1:30.983', recordBy:'Lewis Hamilton',        recordYear:2019, trackKey:'Japan' },
  { round:4,  name:'Bahrain Grand Prix',        short:'Bahrain',      circuit:'Bahrain International Circuit',     city:'Sakhir',       country:'Bahrain',      flag:'🇧🇭', date:'2026-04-19', lat:26.0325,  lng:50.5106,  km:'5.412', laps:57, turns:15, drs:3, record:'1:31.447', recordBy:'Pedro de la Rosa',      recordYear:2005, trackKey:'Bahrain',  suspended:true },
  { round:5,  name:'Saudi Arabian Grand Prix',  short:'Saudi Arabia', circuit:'Jeddah Corniche Circuit',           city:'Jeddah',       country:'Saudi Arabia', flag:'🇸🇦', date:'2026-04-26', lat:21.6319,  lng:39.1044,  km:'6.174', laps:50, turns:27, drs:3, record:'1:28.200', recordBy:'Charles Leclerc',       recordYear:2022, trackKey:'SaudiArabia', suspended:true },
  { round:6,  name:'Miami Grand Prix',          short:'Miami',        circuit:'Miami International Autodrome',     city:'Miami',        country:'USA',          flag:'🇺🇸', date:'2026-05-10', lat:25.9581,  lng:-80.2389, km:'5.412', laps:57, turns:19, drs:3, record:'1:29.708', recordBy:'Max Verstappen',        recordYear:2023, trackKey:'Miami' },
  { round:7,  name:'Emilia Romagna Grand Prix', short:'Imola',        circuit:'Autodromo Enzo e Dino Ferrari',     city:'Imola',        country:'Italy',        flag:'🇮🇹', date:'2026-05-24', lat:44.3439,  lng:11.7167,  km:'4.909', laps:63, turns:19, drs:1, record:'1:15.484', recordBy:'Max Verstappen',        recordYear:2022, trackKey:'EmiliaRomagna' },
  { round:8,  name:'Monaco Grand Prix',         short:'Monaco',       circuit:'Circuit de Monaco',                 city:'Monte Carlo',  country:'Monaco',       flag:'🇲🇨', date:'2026-05-31', lat:43.7347,  lng:7.4206,   km:'3.337', laps:78, turns:19, drs:1, record:'1:10.166', recordBy:'Charles Leclerc',       recordYear:2021, trackKey:'Monaco' },
  { round:9,  name:'Spanish Grand Prix',        short:'Spain',        circuit:'Circuit de Barcelona-Catalunya',    city:'Barcelona',    country:'Spain',        flag:'🇪🇸', date:'2026-06-14', lat:41.5700,  lng:2.2611,   km:'4.675', laps:66, turns:16, drs:3, record:'1:16.330', recordBy:'Max Verstappen',        recordYear:2023, trackKey:'Spain' },
  { round:10, name:'Canadian Grand Prix',       short:'Canada',       circuit:'Circuit Gilles Villeneuve',         city:'Montreal',     country:'Canada',       flag:'🇨🇦', date:'2026-06-21', lat:45.5000,  lng:-73.5228, km:'4.361', laps:70, turns:14, drs:2, record:'1:13.078', recordBy:'Valtteri Bottas',       recordYear:2019, trackKey:'Canada' },
  { round:11, name:'Austrian Grand Prix',       short:'Austria',      circuit:'Red Bull Ring',                     city:'Spielberg',    country:'Austria',      flag:'🇦🇹', date:'2026-07-05', lat:47.2197,  lng:14.7647,  km:'4.318', laps:71, turns:10, drs:3, record:'1:05.619', recordBy:'Carlos Sainz',          recordYear:2020, trackKey:'Austria' },
  { round:12, name:'British Grand Prix',        short:'Britain',      circuit:'Silverstone Circuit',               city:'Silverstone',  country:'UK',           flag:'🇬🇧', date:'2026-07-12', lat:52.0786,  lng:-1.0169,  km:'5.891', laps:52, turns:18, drs:2, record:'1:27.097', recordBy:'Max Verstappen',        recordYear:2020, trackKey:'Britain' },
  { round:13, name:'Belgian Grand Prix',        short:'Belgium',      circuit:'Circuit de Spa-Francorchamps',      city:'Spa',          country:'Belgium',      flag:'🇧🇪', date:'2026-07-26', lat:50.4372,  lng:5.9714,   km:'7.004', laps:44, turns:19, drs:2, record:'1:46.286', recordBy:'Valtteri Bottas',       recordYear:2018, trackKey:'Belgium' },
  { round:14, name:'Hungarian Grand Prix',      short:'Hungary',      circuit:'Hungaroring',                       city:'Budapest',     country:'Hungary',      flag:'🇭🇺', date:'2026-08-02', lat:47.5789,  lng:19.2486,  km:'4.381', laps:70, turns:14, drs:2, record:'1:16.627', recordBy:'Lewis Hamilton',        recordYear:2020, trackKey:'Hungary' },
  { round:15, name:'Dutch Grand Prix',          short:'Netherlands',  circuit:'Circuit Zandvoort',                 city:'Zandvoort',    country:'Netherlands',  flag:'🇳🇱', date:'2026-08-30', lat:52.3888,  lng:4.5409,   km:'4.259', laps:72, turns:14, drs:2, record:'1:11.097', recordBy:'Max Verstappen',        recordYear:2021, trackKey:'Netherlands' },
  { round:16, name:'Italian Grand Prix',        short:'Italy',        circuit:'Autodromo Nazionale Monza',         city:'Monza',        country:'Italy',        flag:'🇮🇹', date:'2026-09-06', lat:45.6156,  lng:9.2811,   km:'5.793', laps:53, turns:11, drs:4, record:'1:21.046', recordBy:'Rubens Barrichello',    recordYear:2004, trackKey:'Italy' },
  { round:17, name:'Azerbaijan Grand Prix',     short:'Azerbaijan',   circuit:'Baku City Circuit',                 city:'Baku',         country:'Azerbaijan',   flag:'🇦🇿', date:'2026-09-20', lat:40.3725,  lng:49.8533,  km:'6.003', laps:51, turns:20, drs:2, record:'1:43.009', recordBy:'Charles Leclerc',       recordYear:2019, trackKey:'Azerbaijan' },
  { round:18, name:'Singapore Grand Prix',      short:'Singapore',    circuit:'Marina Bay Street Circuit',         city:'Singapore',    country:'Singapore',    flag:'🇸🇬', date:'2026-09-27', lat:1.2914,   lng:103.8644, km:'4.940', laps:62, turns:23, drs:3, record:'1:35.867', recordBy:'Charles Leclerc',       recordYear:2023, trackKey:'Singapore' },
  { round:19, name:'United States Grand Prix',  short:'USA',          circuit:'Circuit of the Americas',           city:'Austin',       country:'USA',          flag:'🇺🇸', date:'2026-10-18', lat:30.1328,  lng:-97.6411, km:'5.513', laps:56, turns:20, drs:2, record:'1:36.169', recordBy:'Charles Leclerc',       recordYear:2019, trackKey:'UnitedStates' },
  { round:20, name:'Mexico City Grand Prix',    short:'Mexico City',  circuit:'Autodromo Hermanos Rodriguez',      city:'Mexico City',  country:'Mexico',       flag:'🇲🇽', date:'2026-10-25', lat:19.4042,  lng:-99.0907, km:'4.304', laps:71, turns:17, drs:2, record:'1:17.774', recordBy:'Valtteri Bottas',       recordYear:2021, trackKey:'Mexico' },
  { round:21, name:'São Paulo Grand Prix',      short:'São Paulo',    circuit:'Autodromo Jose Carlos Pace',        city:'São Paulo',    country:'Brazil',       flag:'🇧🇷', date:'2026-11-08', lat:-23.7036, lng:-46.6997, km:'4.309', laps:71, turns:15, drs:2, record:'1:10.540', recordBy:'Valtteri Bottas',       recordYear:2018, trackKey:'Brazil' },
  { round:22, name:'Las Vegas Grand Prix',      short:'Las Vegas',    circuit:'Las Vegas Strip Circuit',           city:'Las Vegas',    country:'USA',          flag:'🇺🇸', date:'2026-11-21', lat:36.1147,  lng:-115.1728,km:'6.201', laps:50, turns:17, drs:2, record:'1:35.490', recordBy:'Charles Leclerc',       recordYear:2023, trackKey:'LasVegas' },
  { round:23, name:'Qatar Grand Prix',          short:'Qatar',        circuit:'Lusail International Circuit',      city:'Lusail',       country:'Qatar',        flag:'🇶🇦', date:'2026-11-29', lat:25.4900,  lng:51.4542,  km:'5.419', laps:57, turns:16, drs:2, record:'1:24.319', recordBy:'Max Verstappen',        recordYear:2023, trackKey:'Qatar' },
  { round:24, name:'Abu Dhabi Grand Prix',      short:'Abu Dhabi',    circuit:'Yas Marina Circuit',                city:'Abu Dhabi',    country:'UAE',          flag:'🇦🇪', date:'2026-12-06', lat:24.4672,  lng:54.6031,  km:'5.281', laps:58, turns:16, drs:2, record:'1:26.103', recordBy:'Max Verstappen',        recordYear:2021, trackKey:'AbuDhabi' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _raceStatus(race) {
  if (race.suspended) return 'suspended';
  const today = new Date(); today.setHours(0,0,0,0);
  const d     = new Date(race.date); d.setHours(0,0,0,0);
  const diff  = Math.round((d - today) / 86400000);
  if (diff < -3) return 'completed';
  if (diff <= 3) return 'live';
  return 'upcoming';
}

function _findNextRound() {
  const today = new Date(); today.setHours(0,0,0,0);
  return RACES_2026.find(r => {
    if (r.suspended) return false;
    const d = new Date(r.date); d.setHours(0,0,0,0);
    return d >= today;
  });
}

function _formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}

// ─── Globe ────────────────────────────────────────────────────────────────────

let _globe = null;
let _selectedRound = null;

function _initGlobe(containerId) {
  const el = document.getElementById(containerId);
  if (!el || typeof Globe === 'undefined') return null;

  const nextRace = _findNextRound();

  // Pin color by status
  const pinColor = (r) => {
    if (r.round === _selectedRound) return '#FFFFFF';
    const s = _raceStatus(r);
    if (nextRace && r.round === nextRace.round) return '#E10600';
    if (s === 'suspended') return '#FF6B00';
    if (s === 'completed') return '#444455';
    if (s === 'live')      return '#00E676';
    return '#9090A8';
  };

  const pinSize = (r) => {
    if (r.round === _selectedRound) return 0.7;
    if (nextRace && r.round === nextRace.round) return 0.65;
    const s = _raceStatus(r);
    if (s === 'suspended') return 0.42;
    return s === 'completed' ? 0.28 : 0.42;
  };

  const w = el.clientWidth  || el.offsetWidth  || 600;
  const h = el.clientHeight || el.offsetHeight || 600;

  // waitForGlobeReady: wait for earth + sky textures before first paint (avoids black sphere).
  // onGlobeReady + resumeAnimation: globe.gl may pause the loop via IntersectionObserver while
  // the canvas is settling; resume after the globe is actually on the scene.
  // animateIn:false — skip the zoom-in animation so rendering starts immediately
  // waitForGlobeReady:false — don't wait for textures; start loop right away
  const globe = Globe({ animateIn: false, waitForGlobeReady: false })(el)
    .width(w).height(h)
    .globeImageUrl('/static/img/earth-blue-marble.jpg')
    .backgroundImageUrl('https://cdn.jsdelivr.net/npm/globe.gl@2.30.0/example/img/night-sky.png')
    .showAtmosphere(true)
    .atmosphereColor('#4488ff')
    .atmosphereAltitude(0.25)
    .htmlElementsData(RACES_2026)
    .htmlLat('lat')
    .htmlLng('lng')
    .htmlAltitude(0.02)
    .htmlElement(r => {
      const color = pinColor(r);
      const isNext = nextRace && r.round === nextRace.round;
      const isSelected = r.round === _selectedRound;
      const size = isSelected || isNext ? '1.5rem' : (_raceStatus(r) === 'completed' ? '0.9rem' : '1.1rem');
      const glow = isNext ? `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 3px ${color})` : `drop-shadow(0 0 3px ${color})`;
      const wrap = document.createElement('div');
      wrap.style.cssText = `cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:1px;user-select:none;`;
      wrap.innerHTML = `
        <div style="font-size:${size};filter:${glow};opacity:${_raceStatus(r) === 'completed' ? 0.45 : 1};line-height:1;">🏎️</div>
        <div style="font-size:0.55rem;font-weight:700;color:${color};letter-spacing:0.05em;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,0.8);">${r.short}</div>
      `;
      wrap.title = `${r.flag} ${r.name} · ${_formatDate(r.date)}`;
      // Stop globe's drag handler from swallowing the click
      wrap.addEventListener('mousedown', e => e.stopPropagation());
      wrap.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
      wrap.addEventListener('click', e => { e.stopPropagation(); _selectRace(r.round, false); });
      return wrap;
    });

  // Patch pauseAnimation IMMEDIATELY — before IntersectionObserver can fire
  globe.pauseAnimation = () => {};

  // Start our own render loop via Three.js setAnimationLoop which runs
  // unconditionally, bypassing globe.gl's IntersectionObserver gating entirely.
  // We do this after a short delay so the renderer/scene/camera are attached.
  setTimeout(() => {
    const box = document.getElementById(containerId);
    if (box) globe.width(box.clientWidth || w).height(box.clientHeight || h);

    const renderer = globe.renderer();
    const scene    = globe.scene();
    const camera   = globe.camera();

    if (renderer && scene && camera) {
      renderer.setAnimationLoop(() => {
        globe.controls().update();
        renderer.render(scene, camera);
      });
      el._stopGlobeLoop = () => renderer.setAnimationLoop(null);
    } else {
      // Fallback: let globe manage its own loop
      globe.pauseAnimation = Globe.prototype?.pauseAnimation || (() => {});
      globe.resumeAnimation();
    }
  }, 200);

  // Initial auto-rotate
  globe.controls().autoRotate = true;
  globe.controls().autoRotateSpeed = 0.4;
  globe.controls().enableZoom = true;
  globe.controls().minDistance = 150;
  globe.controls().maxDistance = 600;

  // Point of view: start centered on current season's region (Europe/Middle East)
  globe.pointOfView({ lat: 25, lng: 30, altitude: 2.2 }, 0);

  return globe;
}

// ─── Track layout SVG ─────────────────────────────────────────────────────────

// Maps 2026 round number → 2024 round that has the same circuit in Supabase
const _TRACK_REF = {
  1:3, 2:5, 3:4, 4:1, 5:2, 6:6, 7:7, 8:8, 9:10, 10:9,
  11:11, 12:12, 13:14, 14:13, 15:15, 16:16, 17:17, 18:18,
  19:19, 20:20, 21:21, 22:22, 23:23, 24:24,
};

function _coordsToSvg(coords, W = 200, H = 130, PAD = 10) {
  const xs = coords.x, ys = coords.y;
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scaleX = (W - 2 * PAD) / (maxX - minX || 1);
  const scaleY = (H - 2 * PAD) / (maxY - minY || 1);
  const scale  = Math.min(scaleX, scaleY);
  const offX = PAD + ((W - 2 * PAD) - (maxX - minX) * scale) / 2;
  const offY = PAD + ((H - 2 * PAD) - (maxY - minY) * scale) / 2;
  const pts = xs.map((x, i) =>
    `${(offX + (x - minX) * scale).toFixed(1)},${(offY + (ys[i] - minY) * scale).toFixed(1)}`
  ).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
    <polyline points="${pts}" fill="none" stroke="#E10600" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
    <polyline points="${pts}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

async function _loadTrackSvg(round) {
  const ref = _TRACK_REF[round] || round;
  try {
    const resp = await fetch(`/api/track/2024/${ref}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return _coordsToSvg(data.coordinates);
  } catch { return null; }
}

// ─── Track info panel ─────────────────────────────────────────────────────────

let _panelCollapsed = false;

function _renderTrackPanel(race) {
  const existing = document.getElementById('cal2-track-panel');
  if (existing) existing.remove();
  if (!race) return;

  const status = _raceStatus(race);
  const statusLabel = race.suspended ? 'Suspended' : status === 'completed' ? 'Completed' : status === 'live' ? 'Live Now' : 'Upcoming';
  const statusColor = race.suspended ? '#FF6B00' : status === 'completed' ? '#555568' : status === 'live' ? '#00E676' : '#9090A8';

  const panel = document.createElement('div');
  panel.id = 'cal2-track-panel';
  if (_panelCollapsed) panel.classList.add('ctp-collapsed');
  panel.innerHTML = `
    <div class="ctp-header" id="ctp-header-btn" style="cursor:pointer;" title="Toggle details">
      <span class="ctp-flag">${race.flag}</span>
      <div class="ctp-title-wrap">
        <div class="ctp-name">${race.name}</div>
        <div class="ctp-circuit">${race.circuit} · ${race.city}, ${race.country}</div>
      </div>
      <span class="ctp-status" style="color:${statusColor};border-color:${statusColor}33;background:${statusColor}11">${statusLabel}</span>
      <button class="ctp-toggle-btn" aria-label="Toggle panel" title="Collapse / expand">
        <svg class="ctp-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <polyline points="18 15 12 9 6 15"/>
        </svg>
      </button>
    </div>
    <div class="ctp-body">
      <div class="ctp-inner">
        <div class="ctp-track-wrap">
          <div class="ctp-track-svg" id="ctp-track-svg"><div class="ctp-track-loading">Loading layout…</div></div>
        </div>
        <div class="ctp-stats">
          <div class="ctp-stat"><div class="ctp-stat-val">${race.km} km</div><div class="ctp-stat-label">Length</div></div>
          <div class="ctp-stat"><div class="ctp-stat-val">${race.laps}</div><div class="ctp-stat-label">Laps</div></div>
          <div class="ctp-stat"><div class="ctp-stat-val">${(race.km * race.laps).toFixed(1)}</div><div class="ctp-stat-label">Race km</div></div>
          <div class="ctp-stat"><div class="ctp-stat-val">${race.turns}</div><div class="ctp-stat-label">Corners</div></div>
          <div class="ctp-stat"><div class="ctp-stat-val">${race.drs}</div><div class="ctp-stat-label">DRS</div></div>
          <div class="ctp-stat ctp-stat--record">
            <div class="ctp-stat-val">${race.record}</div>
            <div class="ctp-stat-label">Record · ${race.recordBy.split(' ').pop()} ${race.recordYear}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const globePanel = document.querySelector('.cal2-globe-panel');
  if (globePanel) {
    globePanel.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('ctp-visible'));
  }

  // Toggle collapse on header click
  const headerBtn = panel.querySelector('#ctp-header-btn');
  headerBtn.addEventListener('click', () => {
    _panelCollapsed = !_panelCollapsed;
    panel.classList.toggle('ctp-collapsed', _panelCollapsed);
  });

  // Load track layout asynchronously
  _loadTrackSvg(race.round).then(svg => {
    const el = document.getElementById('ctp-track-svg');
    if (el) el.innerHTML = svg || '<div class="ctp-track-loading" style="color:#444">Layout unavailable</div>';
  });
}

// ─── Select + fly ─────────────────────────────────────────────────────────────

function _selectRace(round, flyGlobe = true) {
  _selectedRound = round;
  const race = RACES_2026.find(r => r.round === round);
  if (!race) return;

  // Show track info panel
  _renderTrackPanel(race);

  // Highlight card
  document.querySelectorAll('.cal2-card').forEach(c => c.classList.remove('cal2-card--selected'));
  const card = document.querySelector(`[data-round="${round}"]`);
  if (card) {
    card.classList.add('cal2-card--selected');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Fly globe
  if (_globe && flyGlobe) {
    _globe.controls().autoRotate = false;
    _globe.pointOfView({ lat: race.lat, lng: race.lng, altitude: 1.6 }, 900);
  }

  // Refresh HTML car pins
  if (_globe) {
    _globe.htmlElementsData([...RACES_2026]);
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderCalendar() {
  const container = document.getElementById('calendar-content');
  if (!container) return;

  const nextRace = _findNextRound();
  const profile  = window.userProfile;
  const favDriver = profile?.favorite_driver_code;

  container.innerHTML = `
    <div class="cal2-layout">

      <!-- Globe panel -->
      <div class="cal2-globe-panel">
        <div id="cal2-globe"></div>
        <div class="cal2-globe-overlay">
          <div class="cal2-season-badge">2026 Season · 24 Rounds</div>
          ${nextRace ? `
            <div class="cal2-next-badge">
              <span class="cal2-next-pulse"></span>
              Next: ${nextRace.flag} ${nextRace.short} · ${_formatDate(nextRace.date)}
            </div>` : ''}
        </div>
        <div class="cal2-globe-hint">Drag to rotate · Scroll to zoom · Click a pin</div>
      </div>

      <!-- Race list panel -->
      <div class="cal2-list-panel">
        <div class="cal2-list-header">
          <h2 class="cal2-list-title">Race Calendar</h2>
          <div class="cal2-legend">
            <span class="cal2-legend-dot" style="background:#E10600"></span>Next
            <span class="cal2-legend-dot" style="background:#9090A8;margin-left:10px;"></span>Upcoming
            <span class="cal2-legend-dot" style="background:#444455;margin-left:10px;"></span>Done
          </div>
        </div>
        <div class="cal2-list" id="cal2-list">
          ${RACES_2026.map(race => {
            const status      = _raceStatus(race);
            const isNext      = nextRace && nextRace.round === race.round;
            const isDone      = status === 'completed';
            const isLive      = status === 'live';
            const isSuspended = status === 'suspended';
            const dotColor = isNext ? '#E10600' : isLive ? '#00E676' : isSuspended ? '#FF6B00' : isDone ? '#333344' : '#555568';
            return `
              <div class="cal2-card ${isNext ? 'cal2-card--next' : ''} ${isDone ? 'cal2-card--done' : ''} ${isSuspended ? 'cal2-card--suspended' : ''}"
                   data-round="${race.round}"
                   tabindex="0" role="button" aria-label="${race.name}">
                <div class="cal2-card-dot" style="background:${dotColor}"></div>
                <div class="cal2-card-flag">${race.flag}</div>
                <div class="cal2-card-body">
                  <div class="cal2-card-name">${race.name}</div>
                  <div class="cal2-card-circuit">${race.circuit}</div>
                </div>
                <div class="cal2-card-right">
                  <div class="cal2-card-round">R${race.round}</div>
                  <div class="cal2-card-date">${_formatDate(race.date)}</div>
                  ${isNext      ? '<span class="cal2-pill cal2-pill--next"><span class="cal2-pulse"></span>Next</span>' : ''}
                  ${isLive      ? '<span class="cal2-pill cal2-pill--live"><span class="cal2-pulse"></span>Live</span>' : ''}
                  ${isDone      ? '<span class="cal2-pill cal2-pill--done">Done</span>' : ''}
                  ${isSuspended ? '<span class="cal2-pill cal2-pill--suspended">Suspended</span>' : ''}
                  ${!isNext && !isLive && !isDone && !isSuspended ? '<span class="cal2-pill cal2-pill--upcoming">Upcoming</span>' : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

    </div>
  `;

  // Wire card clicks → globe fly
  document.querySelectorAll('.cal2-card').forEach(card => {
    const round = parseInt(card.dataset.round);
    card.addEventListener('click', () => _selectRace(round, true));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') _selectRace(round, true); });
  });

  // Boot globe after layout settles — setTimeout is more reliable than rAF for CSS grid
  setTimeout(() => {
    if (_globe) { _globe._destructor?.(); _globe = null; } // tear down any stale instance
    _globe = _initGlobe('cal2-globe');
    if (nextRace) _selectRace(nextRace.round, true);
  }, 150);
}

// ─── Resize globe to its container ────────────────────────────────────────────

function _resizeGlobe() {
  if (!_globe) return;
  const el = document.getElementById('cal2-globe');
  if (!el) return;
  _globe.width(el.clientWidth).height(el.clientHeight);
}

window.addEventListener('resize', _resizeGlobe);

// ─── Bootstrap ────────────────────────────────────────────────────────────────

window.addEventListener('view:activated', ({ detail }) => {
  if (detail.viewId === 'calendar-view') {
    renderCalendar();
    // After layout + globe init, ensure the loop wasn't left paused (IntersectionObserver / tab timing).
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (!_globe) return;
        const box = document.getElementById('cal2-globe');
        if (box) _globe.width(box.clientWidth).height(box.clientHeight);
        _globe.resumeAnimation?.();
      }, 320);
    });
  } else if (_globe) {
    _globe.controls().autoRotate = false;
  }
});

window.addEventListener('auth:ready', () => {
  if (document.getElementById('calendar-view')?.classList.contains('active')) renderCalendar();
});

export { RACES_2026, renderCalendar };
