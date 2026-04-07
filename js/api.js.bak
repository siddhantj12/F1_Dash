// ============================================================
// API SERVICE — connects to the FastAPI backend on port 8002
// All methods fall back to mock data if the server is unavailable
// ============================================================

// Detect if we're being served from the FastAPI server itself or standalone
const API_BASE = (() => {
  if (window.location.protocol !== 'file:') return '/api';
  return 'http://localhost:8000/api';
})();

async function apiFetch(path, mockFn) {
  try {
    const resp = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (e) {
    console.warn(`[API] Mock fallback for ${path}:`, e.message);
    return mockFn();
  }
}

// ============================================================
// TEAM COLORS  (official 2024/2025 palette)
// ============================================================
const TEAM_COLORS = {
  'Red Bull Racing': '#3671C6', 'Ferrari': '#F91536',
  'Mercedes': '#6CD3BF', 'McLaren': '#FF8000',
  'Aston Martin': '#358C75', 'Alpine': '#FF87BC',
  'Williams': '#64C4FF', 'RB': '#6692FF',
  'Kick Sauber': '#52E252', 'Haas F1 Team': '#B6BABD',
  VER: '#3671C6', PER: '#3671C6',
  LEC: '#F91536', SAI: '#F91536',
  HAM: '#6CD3BF', RUS: '#6CD3BF',
  NOR: '#FF8000', PIA: '#FF8000',
  ALO: '#358C75', STR: '#358C75',
};

function getDriverColor(driverCode, teamName) {
  return TEAM_COLORS[teamName] || TEAM_COLORS[driverCode] || '#E10600';
}

// ============================================================
// API METHODS
// ============================================================
const APIService = {

  getSeasons: () => apiFetch('/seasons', () => [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018]),

  getRaces: (year) => apiFetch(`/races/${year}`, () => [
    { round: 1, name: 'Bahrain GP', circuit: 'Sakhir' },
    { round: 2, name: 'Saudi Arabian GP', circuit: 'Jeddah' },
    { round: 3, name: 'Australian GP', circuit: 'Melbourne' },
    { round: 4, name: 'Chinese (Shanghai) GP', circuit: 'Shanghai' },
  ]),

  getSessions: (year, round) => apiFetch(`/sessions/${year}/${round}`, () =>
    ['Practice 1', 'Practice 2', 'Practice 3', 'Qualifying', 'Race']
  ),

  getDrivers: (year, round, session) => apiFetch(`/drivers/${year}/${round}/${session}`, () => [
    { code: 'VER', name: 'Max Verstappen', team: 'Red Bull Racing' },
    { code: 'LEC', name: 'Charles Leclerc', team: 'Ferrari' },
    { code: 'HAM', name: 'Lewis Hamilton', team: 'Mercedes' },
    { code: 'NOR', name: 'Lando Norris', team: 'McLaren' },
    { code: 'ALO', name: 'Fernando Alonso', team: 'Aston Martin' },
  ]),

  getLaps: (year, round, session, driver) => apiFetch(`/laps/${year}/${round}/${session}/${driver}`, () =>
    [1,2,3,4,5,6,7,8,9,10].map(n => ({ lap: n, time: `1:3${n}.${(Math.random()*900+100).toFixed(0)}` }))
  ),

  // Returns { circuit_name, coordinates: { x[], y[], distance[] } }
  getTrack: (year, round) => apiFetch(`/track/${year}/${round}`, () => {
    // Mock: generate a parametric figure-8 when API unavailable
    const pts = [];
    for (let i = 0; i <= 360; i += 4) {
      const r = i * Math.PI / 180;
      pts.push({
        x: Math.cos(r) * 800 + Math.cos(r * 2) * 200,
        y: Math.sin(r) * 400
      });
    }
    return {
      circuit_name: 'Demo Circuit',
      coordinates: { x: pts.map(p => p.x), y: pts.map(p => p.y), distance: pts.map((_, i) => i) }
    };
  }),

  getTelemetry: (year, round, session, driver, lap) => apiFetch(
    `/telemetry/${year}/${round}/${session}/${driver}/${lap}`,
    () => Array.from({ length: 150 }, (_, i) => ({
      time: i * 0.5,
      speed: 100 + Math.sin(i / 8) * 120 + Math.random() * 20,
      throttle: Math.abs(Math.sin(i / 6)) * 100,
      brake: Math.random() > 0.85 ? 100 : 0,
      gear: Math.floor(Math.abs(Math.sin(i / 10)) * 7) + 1,
      x: 0, y: 0
    }))
  ),

  getComparison: (year, round, session, d1, l1, d2, l2) => apiFetch(
    `/compare/${year}/${round}/${session}/${d1}/${l1}/${d2}/${l2}`,
    () => {
      const mkData = () => Array.from({ length: 150 }, (_, i) => ({
        time: i * 0.5,
        speed: 100 + Math.sin(i / 8) * 120 + Math.random() * 20,
        throttle: Math.abs(Math.sin(i / 6)) * 100,
        brake: Math.random() > 0.85 ? 100 : 0,
        gear: Math.floor(Math.abs(Math.sin(i / 10)) * 7) + 1,
      }));
      const d = mkData();
      return {
        driver1: { code: d1, color: getDriverColor(d1), data: { time: d.map(r=>r.time), speed: d.map(r=>r.speed), throttle: d.map(r=>r.throttle), brake: d.map(r=>r.brake), gear: d.map(r=>r.gear) } },
        driver2: { code: d2, color: getDriverColor(d2), data: { time: d.map(r=>r.time), speed: d.map(r=>r.speed+10), throttle: d.map(r=>r.throttle-5), brake: d.map(r=>r.brake), gear: d.map(r=>r.gear) } },
      };
    }
  ),

  initStandingsWebsocket: (callback) => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.protocol !== 'file:' ? window.location.host : 'localhost:8002';
    try {
      const ws = new WebSocket(`${proto}://${host}/api/ws/positions`);
      ws.onmessage = (e) => callback(JSON.parse(e.data));
      ws.onerror = () => { throw new Error('WS unavailable'); };
    } catch {
      const MOCK = [
        { pos: 1, name: 'Verstappen', team: 'redbull', gap: '--' },
        { pos: 2, name: 'Leclerc', team: 'ferrari', gap: '+0.000' },
        { pos: 3, name: 'Norris', team: 'mclaren', gap: '+0.336' },
        { pos: 4, name: 'Hamilton', team: 'mercedes', gap: '+0.824' },
        { pos: 5, name: 'Russell', team: 'mercedes', gap: '+1.638' },
        { pos: 6, name: 'Sainz', team: 'ferrari', gap: '+1.833' },
        { pos: 7, name: 'Alonso', team: 'aston', gap: '+2.000' },
        { pos: 8, name: 'Perez', team: 'redbull', gap: '+2.607' },
      ];
      setTimeout(() => callback(MOCK), 500);
      setInterval(() => callback(MOCK), 10000);
    }
  }
};

window.APIService = APIService;
window.getDriverColor = getDriverColor;
