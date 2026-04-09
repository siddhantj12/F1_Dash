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
  { round:1,  name:'Australian Grand Prix',    short:'Australia',     circuit:'Albert Park',               city:'Melbourne',    country:'Australia',   flag:'🇦🇺', date:'2026-03-15', lat:-37.8497, lng:144.9680 },
  { round:2,  name:'Chinese Grand Prix',        short:'China',         circuit:'Shanghai International',    city:'Shanghai',     country:'China',       flag:'🇨🇳', date:'2026-03-22', lat:31.3389,  lng:121.2198 },
  { round:3,  name:'Japanese Grand Prix',       short:'Japan',         circuit:'Suzuka Circuit',            city:'Suzuka',       country:'Japan',       flag:'🇯🇵', date:'2026-04-05', lat:34.8431,  lng:136.5414 },
  { round:4,  name:'Bahrain Grand Prix',        short:'Bahrain',       circuit:'Bahrain International',     city:'Sakhir',       country:'Bahrain',     flag:'🇧🇭', date:'2026-04-19', lat:26.0325,  lng:50.5106,  suspended:true },
  { round:5,  name:'Saudi Arabian Grand Prix',  short:'Saudi Arabia',  circuit:'Jeddah Corniche Circuit',   city:'Jeddah',       country:'Saudi Arabia',flag:'🇸🇦', date:'2026-04-26', lat:21.6319,  lng:39.1044,  suspended:true },
  { round:6,  name:'Miami Grand Prix',          short:'Miami',         circuit:'Miami International',       city:'Miami',        country:'USA',         flag:'🇺🇸', date:'2026-05-10', lat:25.9581,  lng:-80.2389 },
  { round:7,  name:'Emilia Romagna Grand Prix', short:'Imola',         circuit:'Autodromo Enzo e Dino Ferrari', city:'Imola',    country:'Italy',       flag:'🇮🇹', date:'2026-05-24', lat:44.3439,  lng:11.7167  },
  { round:8,  name:'Monaco Grand Prix',         short:'Monaco',        circuit:'Circuit de Monaco',         city:'Monaco',       country:'Monaco',      flag:'🇲🇨', date:'2026-05-31', lat:43.7347,  lng:7.4206   },
  { round:9,  name:'Spanish Grand Prix',        short:'Spain',         circuit:'Circuit de Barcelona-Catalunya', city:'Barcelona', country:'Spain',    flag:'🇪🇸', date:'2026-06-14', lat:41.5700,  lng:2.2611   },
  { round:10, name:'Canadian Grand Prix',       short:'Canada',        circuit:'Circuit Gilles Villeneuve', city:'Montreal',     country:'Canada',      flag:'🇨🇦', date:'2026-06-21', lat:45.5000,  lng:-73.5228 },
  { round:11, name:'Austrian Grand Prix',       short:'Austria',       circuit:'Red Bull Ring',             city:'Spielberg',    country:'Austria',     flag:'🇦🇹', date:'2026-07-05', lat:47.2197,  lng:14.7647  },
  { round:12, name:'British Grand Prix',        short:'Britain',       circuit:'Silverstone Circuit',       city:'Silverstone',  country:'UK',          flag:'🇬🇧', date:'2026-07-12', lat:52.0786,  lng:-1.0169  },
  { round:13, name:'Belgian Grand Prix',        short:'Belgium',       circuit:'Circuit de Spa-Francorchamps', city:'Spa',       country:'Belgium',     flag:'🇧🇪', date:'2026-07-26', lat:50.4372,  lng:5.9714   },
  { round:14, name:'Hungarian Grand Prix',      short:'Hungary',       circuit:'Hungaroring',               city:'Budapest',     country:'Hungary',     flag:'🇭🇺', date:'2026-08-02', lat:47.5789,  lng:19.2486  },
  { round:15, name:'Dutch Grand Prix',          short:'Netherlands',   circuit:'Circuit Zandvoort',         city:'Zandvoort',    country:'Netherlands', flag:'🇳🇱', date:'2026-08-30', lat:52.3888,  lng:4.5409   },
  { round:16, name:'Italian Grand Prix',        short:'Italy',         circuit:'Autodromo Nazionale Monza', city:'Monza',        country:'Italy',       flag:'🇮🇹', date:'2026-09-06', lat:45.6156,  lng:9.2811   },
  { round:17, name:'Azerbaijan Grand Prix',     short:'Azerbaijan',    circuit:'Baku City Circuit',         city:'Baku',         country:'Azerbaijan',  flag:'🇦🇿', date:'2026-09-20', lat:40.3725,  lng:49.8533  },
  { round:18, name:'Singapore Grand Prix',      short:'Singapore',     circuit:'Marina Bay Street Circuit', city:'Singapore',    country:'Singapore',   flag:'🇸🇬', date:'2026-09-27', lat:1.2914,   lng:103.8644 },
  { round:19, name:'United States Grand Prix',  short:'USA (Austin)',  circuit:'Circuit of the Americas',   city:'Austin',       country:'USA',         flag:'🇺🇸', date:'2026-10-18', lat:30.1328,  lng:-97.6411 },
  { round:20, name:'Mexico City Grand Prix',    short:'Mexico City',   circuit:'Autodromo Hermanos Rodriguez', city:'Mexico City', country:'Mexico',    flag:'🇲🇽', date:'2026-10-25', lat:19.4042,  lng:-99.0907 },
  { round:21, name:'São Paulo Grand Prix',      short:'São Paulo',     circuit:'Autodromo Jose Carlos Pace', city:'São Paulo',   country:'Brazil',      flag:'🇧🇷', date:'2026-11-08', lat:-23.7036, lng:-46.6997 },
  { round:22, name:'Las Vegas Grand Prix',      short:'Las Vegas',     circuit:'Las Vegas Strip Circuit',   city:'Las Vegas',    country:'USA',         flag:'🇺🇸', date:'2026-11-21', lat:36.1147,  lng:-115.1728},
  { round:23, name:'Qatar Grand Prix',          short:'Qatar',         circuit:'Lusail International',      city:'Lusail',       country:'Qatar',       flag:'🇶🇦', date:'2026-11-29', lat:25.4900,  lng:51.4542  },
  { round:24, name:'Abu Dhabi Grand Prix',      short:'Abu Dhabi',     circuit:'Yas Marina Circuit',        city:'Abu Dhabi',    country:'UAE',         flag:'🇦🇪', date:'2026-12-06', lat:24.4672,  lng:54.6031  },
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

  const globe = Globe({ animateIn: true })(el)
    .width(w).height(h)
    // Globe appearance — dark with subtle blue tint, no atmosphere glow needed
    .globeImageUrl('https://cdn.jsdelivr.net/npm/globe.gl@2.30.0/example/img/earth-night.jpg')
    .backgroundImageUrl('https://cdn.jsdelivr.net/npm/globe.gl@2.30.0/example/img/night-sky.png')
    .showAtmosphere(true)
    .atmosphereColor('#1a1a3e')
    .atmosphereAltitude(0.15)
    // Points layer for race pins
    .pointsData(RACES_2026)
    .pointLat('lat')
    .pointLng('lng')
    .pointAltitude(0.01)
    .pointRadius(pinSize)
    .pointColor(pinColor)
    .pointResolution(12)
    .pointsMerge(false)
    // Labels
    .labelsData(RACES_2026.filter(r => {
      if (nextRace && r.round === nextRace.round) return true;
      const s = _raceStatus(r);
      return s !== 'completed' && s !== 'suspended';
    }))
    .labelLat('lat')
    .labelLng('lng')
    .labelText('short')
    .labelSize(1.4)
    .labelDotRadius(0)
    .labelColor(r => nextRace && r.round === nextRace.round ? '#E10600' : 'rgba(200,200,220,0.75)')
    .labelAltitude(0.02)
    .labelResolution(2)
    // Tooltip
    .pointLabel(r => `
      <div style="background:rgba(10,10,13,0.92);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:10px 14px;font-family:'Inter',sans-serif;pointer-events:none;">
        <div style="font-size:1rem;margin-bottom:2px;">${r.flag}</div>
        <div style="font-weight:700;color:#F0F0F5;font-size:0.85rem;">${r.name}</div>
        <div style="color:#9090A8;font-size:0.72rem;margin-top:3px;">${r.circuit}</div>
        <div style="color:#9090A8;font-size:0.72rem;">${_formatDate(r.date)}</div>
      </div>
    `)
    // Click on pin
    .onPointClick(r => _selectRace(r.round, false));

  // Force correct size and kick the render loop.
  // Globe.gl gates animation via IntersectionObserver — if the element isn't intersecting
  // (e.g. inside an iframe or hidden view) it never starts. Poll until a pixel is drawn.
  setTimeout(() => {
    globe.width(el.clientWidth || w).height(el.clientHeight || h);
    globe.resumeAnimation();

    // Poll for up to 3s; once a non-black pixel appears, stop
    let attempts = 0;
    const poll = setInterval(() => {
      globe.resumeAnimation();
      const canvas = el.querySelector('canvas');
      const gl2 = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
      if (gl2) {
        const px = new Uint8Array(4);
        gl2.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl2.RGBA, gl2.UNSIGNED_BYTE, px);
        if (px[0] > 0 || px[1] > 0 || px[2] > 0) { clearInterval(poll); return; }
      }
      if (++attempts > 15) clearInterval(poll);
    }, 200);
  }, 100);

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

// ─── Select + fly ─────────────────────────────────────────────────────────────

function _selectRace(round, flyGlobe = true) {
  _selectedRound = round;
  const race = RACES_2026.find(r => r.round === round);
  if (!race) return;

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

  // Refresh pin colours
  if (_globe) {
    const nextRace = _findNextRound();
    _globe
      .pointColor(r => {
        if (r.round === _selectedRound) return '#FFFFFF';
        const s = _raceStatus(r);
        if (nextRace && r.round === nextRace.round) return '#E10600';
        if (s === 'suspended') return '#FF6B00';
        if (s === 'completed') return '#444455';
        if (s === 'live')      return '#00E676';
        return '#9090A8';
      })
      .pointRadius(r => {
        if (r.round === _selectedRound) return 0.7;
        if (nextRace && r.round === nextRace.round) return 0.65;
        const s = _raceStatus(r);
        return s === 'completed' ? 0.28 : 0.42;
      });
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
  } else {
    // Pause auto-rotate when not in view to save resources
    if (_globe) _globe.controls().autoRotate = false;
  }
});

window.addEventListener('auth:ready', () => {
  if (document.getElementById('calendar-view')?.classList.contains('active')) renderCalendar();
});

export { RACES_2026, renderCalendar };
