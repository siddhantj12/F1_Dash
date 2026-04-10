/**
 * garage.js — My Garage page
 *
 * Shows the authenticated user's favorite driver's 2026 season at a glance:
 *   - Hero bar: photo, name, number, team, current championship position
 *   - Season results table (round-by-round finish + points)
 *   - Points progression chart vs. championship leader
 *   - Telemetry shortcut
 *   - Top 3 news articles mentioning the driver/team
 *
 * Anonymous / no-favorite state: CTA to sign in or pick a driver.
 */

import Profile, { TEAM_COLORS, FALLBACK_DRIVERS } from '/static/js/profile.js';
import { RACES_2026 } from '/static/js/calendar.js';

// Points lookup by finishing position
const POINTS_TABLE = { 1:25, 2:18, 3:15, 4:12, 5:10, 6:8, 7:6, 8:4, 9:2, 10:1 };

let _garageChart = null;

// ─── Render helpers ────────────────────────────────────────────────────────────

function _renderAnonymous() {
  const el = document.getElementById('garage-content');
  if (!el) return;
  el.innerHTML = `
    <div class="garage-anon">
      <div class="garage-anon-icon"><i class="fa-solid fa-flag-checkered"></i></div>
      <h2>Pick Your Driver</h2>
      <p>Choose your favourite driver to track their 2026 season — no account needed.</p>
      <button class="garage-anon-btn" id="garage-pick-driver-btn">
        <i class="fa-solid fa-user-plus"></i> Pick a Driver
      </button>
    </div>
  `;
  document.getElementById('garage-pick-driver-btn')?.addEventListener('click', () => {
    Profile.openOnboarding();
  });
}

function _renderNoFavorite() {
  const el = document.getElementById('garage-content');
  if (!el) return;
  el.innerHTML = `
    <div class="garage-anon">
      <div class="garage-anon-icon"><i class="fa-solid fa-user-plus"></i></div>
      <h2>No driver selected yet</h2>
      <p>Pick your favourite driver to see their season here.</p>
      <button class="garage-anon-btn" id="garage-pick-btn">Pick a Driver</button>
    </div>
  `;
  document.getElementById('garage-pick-btn')?.addEventListener('click', () => {
    Profile.openOnboarding();
  });
}

async function _fetchStandings() {
  try {
    const resp = await fetch('/api/standings/2026');
    if (!resp.ok) throw new Error('standings unavailable');
    return await resp.json();
  } catch {
    return null;
  }
}

async function _fetchNews(query) {
  try {
    const resp = await fetch(`/api/news?limit=50`);
    if (!resp.ok) throw new Error('news unavailable');
    const data = await resp.json();
    const articles = data.articles || [];
    const q = query.toLowerCase();
    return articles.filter(a =>
      (a.title + ' ' + (a.description || '')).toLowerCase().includes(q)
    ).slice(0, 3);
  } catch {
    return [];
  }
}

function _buildResultsFromStandings(standings, driverCode) {
  // standings API may not exist yet; return empty array gracefully
  if (!standings?.results) return [];
  return standings.results
    .filter(r => r.driver === driverCode)
    .map(r => ({ round: r.round, position: r.position, points: POINTS_TABLE[r.position] || 0 }));
}

const _DRIVER_PHOTO_MAP = {
  VER: { slug:'verstappen',  year:2024 }, LAW: { slug:'lawson',      year:2024 },
  LEC: { slug:'leclerc',     year:2024 }, HAM: { slug:'hamilton',    year:2025 },
  RUS: { slug:'russell',     year:2024 }, ANT: { slug:'antonelli',   year:2025 },
  NOR: { slug:'norris',      year:2024 }, PIA: { slug:'piastri',     year:2024 },
  ALO: { slug:'alonso',      year:2024 }, STR: { slug:'stroll',      year:2024 },
  GAS: { slug:'gasly',       year:2024 }, DOO: { slug:'doohan',      year:2025 },
  BEA: { slug:'bearman',     year:2024 }, OCO: { slug:'ocon',        year:2024 },
  ALB: { slug:'albon',       year:2024 }, SAI: { slug:'sainz',       year:2024 },
  TSU: { slug:'tsunoda',     year:2024 }, HAD: { slug:'hadjar',      year:2025 },
  HUL: { slug:'hulkenberg',  year:2024 }, BOR: { slug:'bortoleto',   year:2025 },
};
const _F1_CDN = 'https://media.formula1.com/image/upload/f_auto/q_auto/v1706188352/content/dam/fom-website/drivers';

function _driverPhotoUrl(name, code) {
  const entry = code && _DRIVER_PHOTO_MAP[code];
  if (entry) return `${_F1_CDN}/${entry.year}Drivers/${entry.slug}.png`;
  const slug = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '');
  return `${_F1_CDN}/2024Drivers/${slug}.png`;
}

function _renderHero(driver, profile, teamColor) {
  const photoUrl = _driverPhotoUrl(driver.name, driver.code);

  return `
    <div class="garage-hero" style="--team-color:${teamColor}">
      <div class="garage-hero-photo-wrap">
        <img
          src="${photoUrl}"
          alt="${driver.name}"
          class="garage-hero-photo"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
        >
        <div class="garage-hero-initials" style="background:${teamColor}22;color:${teamColor}">
          ${driver.name.split(' ').map(p=>p[0]).join('').slice(0,3).toUpperCase()}
        </div>
      </div>
      <div class="garage-hero-info">
        <div class="garage-hero-number" style="color:${teamColor}">${driver.number}</div>
        <div class="garage-hero-name">${driver.name}</div>
        <div class="garage-hero-team" style="color:${teamColor}">${driver.teamName}</div>
      </div>
      <div class="garage-hero-stats" id="garage-hero-stats">
        <div class="garage-stat"><div class="garage-stat-label">Season</div><div class="garage-stat-val">2026</div></div>
        <div class="garage-stat" id="garage-stat-pos"><div class="garage-stat-label">Championship</div><div class="garage-stat-val">—</div></div>
        <div class="garage-stat" id="garage-stat-pts"><div class="garage-stat-label">Points</div><div class="garage-stat-val">—</div></div>
        <div class="garage-stat" id="garage-stat-wins"><div class="garage-stat-label">Wins</div><div class="garage-stat-val">—</div></div>
      </div>
    </div>
  `;
}

function _renderResultsTable(results, races) {
  if (!results.length) {
    return `<div class="garage-section-empty">Season results will appear here as races complete.</div>`;
  }
  const rows = results.map(r => {
    const race = races.find(rc => rc.round === r.round);
    const posClass = r.position === 1 ? 'pos-win' : r.position <= 3 ? 'pos-podium' : r.position <= 10 ? 'pos-points' : 'pos-out';
    return `
      <tr>
        <td class="rt-round">R${r.round}</td>
        <td class="rt-race">${race ? race.flag + ' ' + race.name.replace(' Grand Prix','') : '—'}</td>
        <td class="rt-pos"><span class="rt-pos-badge ${posClass}">P${r.position}</span></td>
        <td class="rt-pts">${r.points > 0 ? '+' + r.points : '—'}</td>
      </tr>
    `;
  }).join('');
  return `
    <table class="garage-results-table">
      <thead><tr><th>Round</th><th>Race</th><th>Finish</th><th>Pts</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function _renderChart(results, canvasId, teamColor) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !results.length) return;

  if (_garageChart) { _garageChart.destroy(); _garageChart = null; }

  const labels = results.map(r => `R${r.round}`);
  let cumPts = 0;
  const data = results.map(r => { cumPts += r.points; return cumPts; });

  _garageChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Points',
        data,
        borderColor: teamColor,
        backgroundColor: teamColor + '22',
        borderWidth: 2.5,
        pointBackgroundColor: teamColor,
        pointRadius: 4,
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9090A8' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9090A8' }, beginAtZero: true },
      },
    },
  });
}

function _renderNewsCards(articles) {
  if (!articles.length) return '<p class="garage-section-empty">No recent articles found.</p>';
  return articles.map(a => `
    <a class="garage-news-card" href="${a.url}" target="_blank" rel="noopener">
      <div class="gnc-meta">${a.source} · ${a.time_ago || ''}</div>
      <div class="gnc-title">${a.title}</div>
    </a>
  `).join('');
}

// ─── Main render ───────────────────────────────────────────────────────────────

async function renderGarage() {
  const el = document.getElementById('garage-content');
  if (!el) return;

  const profile = window.userProfile;

  if (!profile) { _renderAnonymous(); return; }
  if (!profile.favorite_driver_code) { _renderNoFavorite(); return; }

  const driver = FALLBACK_DRIVERS.find(d => d.code === profile.favorite_driver_code)
    || { code: profile.favorite_driver_code, name: profile.favorite_driver_code, number: '', team: '', teamName: '' };
  const teamColor = TEAM_COLORS[driver.team] || '#E10600';

  // Skeleton while loading
  el.innerHTML = `
    ${_renderHero(driver, profile, teamColor)}
    <div class="garage-body">
      <div class="garage-col garage-col--results">
        <div class="garage-section-title">2026 Season Results</div>
        <div id="garage-results-wrap"><div class="garage-loading">Loading…</div></div>
      </div>
      <div class="garage-col garage-col--chart">
        <div class="garage-section-title">Points Progression</div>
        <div class="garage-chart-wrap"><canvas id="garage-chart" height="220"></canvas></div>
      </div>
    </div>
    <div class="garage-row garage-row--telemetry">
      <div class="garage-section-title">Telemetry</div>
      <button class="garage-telem-btn" id="garage-telem-btn">
        <i class="fa-solid fa-gauge-high"></i> Load ${driver.name.split(' ')[0]}'s Latest Lap
      </button>
    </div>
    <div class="garage-row garage-row--news">
      <div class="garage-section-title">Latest News</div>
      <div id="garage-news-wrap"><div class="garage-loading">Loading…</div></div>
    </div>
  `;

  // Telemetry shortcut
  document.getElementById('garage-telem-btn')?.addEventListener('click', () => {
    document.querySelector('[data-target="telemetry-view"]')?.click();
    window.dispatchEvent(new CustomEvent('telemetry:preselect', {
      detail: { year: 2026, driver: driver.code },
    }));
  });

  // Load data in parallel
  const [standings, news] = await Promise.all([
    _fetchStandings(),
    _fetchNews(driver.name.split(' ').pop()),  // search by last name
  ]);

  const results = _buildResultsFromStandings(standings, driver.code);

  // Update hero stats
  if (results.length) {
    const totalPts = results.reduce((s, r) => s + r.points, 0);
    const wins = results.filter(r => r.position === 1).length;
    document.querySelector('#garage-stat-pts .garage-stat-val').textContent = totalPts;
    document.querySelector('#garage-stat-wins .garage-stat-val').textContent = wins;
    if (standings?.driverStandings) {
      const pos = standings.driverStandings.findIndex(d => d.code === driver.code) + 1;
      if (pos > 0) document.querySelector('#garage-stat-pos .garage-stat-val').textContent = `P${pos}`;
    }
  }

  document.getElementById('garage-results-wrap').innerHTML = _renderResultsTable(results, RACES_2026);
  _renderChart(results, 'garage-chart', teamColor);
  document.getElementById('garage-news-wrap').innerHTML = _renderNewsCards(news);
}

// ─── Bootstrap ─────────────────────────────────────────────────────────────────

window.addEventListener('view:activated', ({ detail }) => {
  if (detail.viewId === 'garage-view') renderGarage();
});

// Re-render if profile loads or updates while garage is already active
window.addEventListener('auth:ready', () => {
  const garageView = document.getElementById('garage-view');
  if (garageView?.classList.contains('active')) renderGarage();
});

window.addEventListener('profile:updated', () => {
  renderGarage();
});

export { renderGarage };
