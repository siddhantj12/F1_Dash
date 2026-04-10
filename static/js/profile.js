/**
 * profile.js — user profile manager
 *
 * Responsibilities:
 *   1. After auth:ready, fetch /api/me for logged-in users
 *   2. Expose window.userProfile for other modules
 *   3. Trigger the onboarding modal when onboarding_complete = false
 *   4. Update the sidebar footer + topbar avatar with user info
 *
 * Exports:
 *   Profile.load()              — fetch /api/me (called automatically)
 *   Profile.savePreferences()   — PUT /api/me/preferences
 *   Profile.get()               — return current profile or null
 */

import Auth from '/static/js/auth.js';

// 2026 F1 team colours (used for driver/team cards in onboarding)
const TEAM_COLORS = {
  red_bull:     '#3671C6',
  ferrari:      '#F91536',
  mercedes:     '#6CD3BF',
  mclaren:      '#FF8000',
  aston_martin: '#358C75',
  alpine:       '#FF87BC',
  haas:         '#B6BABD',
  williams:     '#64C4FF',
  rb:           '#6692FF',
  audi:         '#B3B4B4',
};

// Fallback 2026 driver roster (used if /api/drivers/2026/R fails to load)
const FALLBACK_DRIVERS = [
  { code: 'VER', name: 'Max Verstappen',      number: 1,  team: 'red_bull',     teamName: 'Red Bull Racing' },
  { code: 'LAW', name: 'Liam Lawson',         number: 30, team: 'red_bull',     teamName: 'Red Bull Racing' },
  { code: 'LEC', name: 'Charles Leclerc',     number: 16, team: 'ferrari',      teamName: 'Ferrari' },
  { code: 'HAM', name: 'Lewis Hamilton',      number: 44, team: 'ferrari',      teamName: 'Ferrari' },
  { code: 'RUS', name: 'George Russell',      number: 63, team: 'mercedes',     teamName: 'Mercedes' },
  { code: 'ANT', name: 'Andrea Kimi Antonelli', number: 12, team: 'mercedes',   teamName: 'Mercedes' },
  { code: 'NOR', name: 'Lando Norris',        number: 4,  team: 'mclaren',      teamName: 'McLaren' },
  { code: 'PIA', name: 'Oscar Piastri',       number: 81, team: 'mclaren',      teamName: 'McLaren' },
  { code: 'ALO', name: 'Fernando Alonso',     number: 14, team: 'aston_martin', teamName: 'Aston Martin' },
  { code: 'STR', name: 'Lance Stroll',        number: 18, team: 'aston_martin', teamName: 'Aston Martin' },
  { code: 'GAS', name: 'Pierre Gasly',        number: 10, team: 'alpine',       teamName: 'Alpine' },
  { code: 'DOO', name: 'Jack Doohan',         number: 7,  team: 'alpine',       teamName: 'Alpine' },
  { code: 'BEA', name: 'Oliver Bearman',      number: 87, team: 'haas',         teamName: 'Haas' },
  { code: 'OCO', name: 'Esteban Ocon',        number: 31, team: 'haas',         teamName: 'Haas' },
  { code: 'ALB', name: 'Alex Albon',          number: 23, team: 'williams',     teamName: 'Williams' },
  { code: 'SAI', name: 'Carlos Sainz',        number: 55, team: 'williams',     teamName: 'Williams' },
  { code: 'LIN', name: 'Arvid Lindblad',      number: 6,  team: 'rb',           teamName: 'RB' },
  { code: 'HAD', name: 'Isack Hadjar',        number: 22, team: 'rb',           teamName: 'RB' },
  { code: 'HUL', name: 'Nico Hulkenberg',     number: 27, team: 'audi',         teamName: 'Audi' },
  { code: 'BOR', name: 'Gabriel Bortoleto',   number: 5,  team: 'audi',         teamName: 'Audi' },
];

const FALLBACK_TEAMS = [
  { id: 'red_bull',     name: 'Red Bull Racing' },
  { id: 'ferrari',      name: 'Ferrari' },
  { id: 'mercedes',     name: 'Mercedes' },
  { id: 'mclaren',      name: 'McLaren' },
  { id: 'aston_martin', name: 'Aston Martin' },
  { id: 'alpine',       name: 'Alpine' },
  { id: 'haas',         name: 'Haas' },
  { id: 'williams',     name: 'Williams' },
  { id: 'rb',           name: 'RB' },
  { id: 'audi',         name: 'Audi' },
];

let _profile = null;

// ─── Guest (localStorage) profile ────────────────────────────────────────────

const GUEST_KEY = 'f1dash_guest_prefs';

function _loadGuestProfile() {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function _saveGuestProfile(prefs) {
  const existing = _loadGuestProfile() || {};
  const updated = {
    ...existing,
    ...prefs,
    is_guest: true,
    display_name: 'F1 Fan',
    onboarding_complete: prefs.onboarding_complete ?? existing.onboarding_complete ?? false,
  };
  localStorage.setItem(GUEST_KEY, JSON.stringify(updated));
  return updated;
}

// ─── Driver photo helpers ─────────────────────────────────────────────────────

const _DRIVER_PHOTO_MAP = {
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

function _driverPhotoUrl(driverName, code) {
  const entry = code && _DRIVER_PHOTO_MAP[code];
  if (entry) return `${_F1_CDN}/${entry.year}Drivers/${entry.slug}.png`;
  const slug = driverName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '');
  return `${_F1_CDN}/2024Drivers/${slug}.png`;
}

function _driverInitials(name) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 3).toUpperCase();
}

function _driverAvatarFallback(driver) {
  const color = TEAM_COLORS[driver.team] || '#E10600';
  return `<div class="driver-initials-avatar" style="background:${color}22;border:2px solid ${color};color:${color}">${_driverInitials(driver.name)}</div>`;
}

// ─── Sidebar + topbar UI ──────────────────────────────────────────────────────

/** Sync in-memory profile from `window` (set by bootstrap or other modules). */
function _syncProfileRef() {
  if (window.userProfile) _profile = window.userProfile;
}

function _updateSidebarFooter(profile) {
  const nameEl = document.querySelector('.footer-name');
  const roleEl = document.querySelector('.footer-role');
  const avatarEl = document.querySelector('.sidebar-footer .avatar-sm');
  const profileBtn = document.querySelector('.profile-btn');

  if (!profile) {
    if (nameEl) nameEl.textContent = 'F1 Fan';
    if (roleEl) roleEl.textContent = 'Race Analyst';
    if (avatarEl) avatarEl.textContent = 'F1';
    if (profileBtn) {
      profileBtn.innerHTML = 'Sign In';
      profileBtn.classList.add('sign-in-btn');
      profileBtn.title = 'Sign in or pick a driver';
      profileBtn.onclick = () => openProfileDrawer();
    }
    const footerBtn = document.getElementById('sidebar-footer-btn');
    if (footerBtn) footerBtn.onclick = () => openProfileDrawer();
    return;
  }

  const driver = FALLBACK_DRIVERS.find(d => d.code === profile.favorite_driver_code);
  const teamColor = driver ? (TEAM_COLORS[driver.team] || '#E10600') : '#E10600';

  if (nameEl) nameEl.textContent = profile.display_name || 'F1 Fan';
  if (roleEl) {
    roleEl.textContent = driver
      ? `${driver.teamName} Fan`
      : 'Race Analyst';
    if (driver) roleEl.style.color = teamColor;
  }

  // Avatar: use Auth0 picture or first letter of name
  const initial = (profile.display_name || 'F')[0].toUpperCase();
  if (avatarEl) {
    if (profile.avatar_url) {
      avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    } else {
      avatarEl.textContent = initial;
      avatarEl.style.background = teamColor;
    }
  }

  if (profileBtn) {
    profileBtn.classList.remove('sign-in-btn');
    profileBtn.innerHTML = driver
      ? driver.code.slice(0, 2).toUpperCase()
      : initial;
    profileBtn.style.background = teamColor;
    profileBtn.title = driver ? driver.name : (profile.display_name || 'Profile');
    profileBtn.onclick = () => openProfileDrawer();
  }

  // Sidebar footer also opens drawer
  const footerBtn = document.getElementById('sidebar-footer-btn');
  if (footerBtn) footerBtn.onclick = () => openProfileDrawer();
}

// ─── Profile API calls ────────────────────────────────────────────────────────

const Profile = {
  get() {
    _syncProfileRef();
    return window.userProfile ?? _profile;
  },

  async load() {
    const token = await Auth.getToken();

    // No token — check if we have a cached authenticated profile (token refresh failed but user was logged in)
    if (!token) {
      if (Auth.isAuthenticated) {
        // Try cached profile from a previous successful fetch
        try {
          const cached = JSON.parse(localStorage.getItem('f1dash_profile') || 'null');
          if (cached && !cached.is_guest) {
            _profile = cached;
            window.userProfile = _profile;
            _updateSidebarFooter(_profile);
            return _profile;
          }
        } catch {}
      }
      const guest = _loadGuestProfile();
      _profile = guest || null;
      window.userProfile = _profile;
      _updateSidebarFooter(_profile);
      return _profile;
    }

    try {
      const resp = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`/api/me returned ${resp.status}`);
      _profile = await resp.json();
      window.userProfile = _profile;
      // Cache for next load if token refresh fails
      localStorage.setItem('f1dash_profile', JSON.stringify(_profile));
      _updateSidebarFooter(_profile);

      if (!_profile.onboarding_complete) {
        await _showOnboardingModal();
      }
      return _profile;
    } catch (e) {
      console.error('[Profile] load error:', e);
      return null;
    }
  },

  async savePreferences({ driverCode, teamId, complete = true, displayName } = {}) {
    const token = await Auth.getToken();

    // Guest mode: no auth token → save to localStorage
    if (!token) {
      const guest = _saveGuestProfile({
        favorite_driver_code: driverCode || null,
        favorite_team_id: teamId || null,
        onboarding_complete: complete,
        ...(displayName ? { display_name: displayName } : {}),
      });
      _profile = guest;
      window.userProfile = _profile;
      _updateSidebarFooter(_profile);
      return _profile;
    }

    const body = {
      favorite_driver_code: driverCode || null,
      favorite_team_id: teamId || null,
      onboarding_complete: complete,
      ...(displayName ? { display_name: displayName } : {}),
    };

    const resp = await fetch('/api/me/preferences', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`/api/me/preferences returned ${resp.status}`);
    _profile = await resp.json();
    window.userProfile = _profile;
    _updateSidebarFooter(_profile);
    return _profile;
  },

  openOnboarding() {
    return _showOnboardingModal();
  },
};

// ─── Onboarding modal ─────────────────────────────────────────────────────────

async function _fetchDrivers() {
  try {
    const resp = await fetch('/api/drivers/2026/R');
    if (!resp.ok) throw new Error('drivers fetch failed');
    const data = await resp.json();
    // Normalize API response into our format
    return (data.drivers || data).map(d => ({
      code: d.Abbreviation || d.code,
      name: (d.FirstName && d.LastName) ? `${d.FirstName} ${d.LastName}` : (d.name || d.FullName),
      number: d.DriverNumber || d.number,
      team: (d.TeamName || d.team || '').toLowerCase().replace(/\s+/g, '_'),
      teamName: d.TeamName || d.teamName || '',
    }));
  } catch {
    return FALLBACK_DRIVERS;
  }
}

async function _showOnboardingModal() {
  if (document.getElementById('onboarding-modal')) return;

  const drivers = await _fetchDrivers();

  // Build modal HTML
  const modal = document.createElement('div');
  modal.id = 'onboarding-modal';
  modal.innerHTML = `
    <div class="onboarding-backdrop"></div>
    <div class="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">

      <div class="onboarding-header">
        <div class="onboarding-logo"><i class="fa-solid fa-flag-checkered"></i></div>
        <h1 id="onboarding-title">Welcome to F1 Dash</h1>
        <p>Pick your driver and team to personalise your experience.</p>
      </div>

      <!-- Step indicator -->
      <div class="onboarding-steps">
        <div class="ob-step active" data-step="1"><span>1</span> Driver</div>
        <div class="ob-step-line"></div>
        <div class="ob-step" data-step="2"><span>2</span> Team</div>
      </div>

      <!-- Step 1: Driver -->
      <div class="onboarding-step-panel" id="ob-panel-1">
        <div class="ob-search-wrap">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input id="ob-driver-search" type="text" placeholder="Search driver…" autocomplete="off">
        </div>
        <div class="ob-driver-grid" id="ob-driver-grid"></div>
      </div>

      <!-- Step 2: Team -->
      <div class="onboarding-step-panel hidden" id="ob-panel-2">
        <div class="ob-team-grid" id="ob-team-grid"></div>
      </div>

      <!-- Footer -->
      <div class="onboarding-footer">
        <button class="ob-btn-skip" id="ob-skip">I'll decide later</button>
        <div class="ob-footer-right">
          <button class="ob-btn-back hidden" id="ob-back">← Back</button>
          <button class="ob-btn-next" id="ob-next" disabled>Next →</button>
        </div>
      </div>

    </div>
  `;
  document.body.appendChild(modal);

  // State
  let selectedDriver = null;
  let selectedTeam = null;
  let currentStep = 1;

  // Render driver grid
  function renderDriverGrid(filter = '') {
    const grid = document.getElementById('ob-driver-grid');
    const filtered = filter
      ? drivers.filter(d => d.name.toLowerCase().includes(filter.toLowerCase()) || d.code.toLowerCase().includes(filter.toLowerCase()))
      : drivers;

    grid.innerHTML = filtered.map(d => {
      const color = TEAM_COLORS[d.team] || '#E10600';
      const isSelected = selectedDriver && selectedDriver.code === d.code;
      return `
        <div class="ob-driver-card ${isSelected ? 'selected' : ''}" data-code="${d.code}" style="--team-color:${color}">
          <div class="ob-driver-photo-wrap">
            <img
              src="${_driverPhotoUrl(d.name, d.code)}"
              alt="${d.name}"
              class="ob-driver-photo"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
            >
            <div class="ob-driver-initials" style="display:none;background:${color}22;color:${color}">${_driverInitials(d.name)}</div>
          </div>
          <div class="ob-driver-number" style="color:${color}">${d.number || ''}</div>
          <div class="ob-driver-name">${d.name}</div>
          <div class="ob-driver-team">${d.teamName}</div>
          ${isSelected ? '<div class="ob-selected-check"><i class="fa-solid fa-check"></i></div>' : ''}
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.ob-driver-card').forEach(card => {
      card.addEventListener('click', () => {
        selectedDriver = drivers.find(d => d.code === card.dataset.code);
        renderDriverGrid(document.getElementById('ob-driver-search').value);
        document.getElementById('ob-next').disabled = false;
        document.getElementById('ob-next').textContent = 'Next →';
      });
    });
  }

  // Render team grid (derived from selected driver's peers)
  function renderTeamGrid() {
    const grid = document.getElementById('ob-team-grid');
    grid.innerHTML = FALLBACK_TEAMS.map(t => {
      const color = TEAM_COLORS[t.id] || '#E10600';
      const isSelected = selectedTeam && selectedTeam.id === t.id;
      const isDriverTeam = selectedDriver && selectedDriver.team === t.id;
      return `
        <div class="ob-team-card ${isSelected ? 'selected' : ''} ${isDriverTeam ? 'driver-team' : ''}" data-id="${t.id}" style="--team-color:${color}">
          <div class="ob-team-color-bar" style="background:${color}"></div>
          <div class="ob-team-name">${t.name}</div>
          ${isDriverTeam ? '<div class="ob-team-badge">Your Driver\'s Team</div>' : ''}
          ${isSelected ? '<div class="ob-selected-check"><i class="fa-solid fa-check"></i></div>' : ''}
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.ob-team-card').forEach(card => {
      card.addEventListener('click', () => {
        selectedTeam = FALLBACK_TEAMS.find(t => t.id === card.dataset.id);
        renderTeamGrid();
        document.getElementById('ob-next').disabled = false;
        document.getElementById('ob-next').textContent = selectedDriver
          ? `Start following ${selectedDriver.name.split(' ')[0]} →`
          : 'Save & Go →';
      });
    });
  }

  function goToStep(step) {
    currentStep = step;
    document.getElementById('ob-panel-1').classList.toggle('hidden', step !== 1);
    document.getElementById('ob-panel-2').classList.toggle('hidden', step !== 2);
    document.querySelectorAll('.ob-step').forEach(el => {
      el.classList.toggle('active', parseInt(el.dataset.step) <= step);
    });
    document.getElementById('ob-back').classList.toggle('hidden', step === 1);
    document.getElementById('ob-next').disabled = (step === 1 && !selectedDriver) || (step === 2 && !selectedTeam);
    if (step === 1) document.getElementById('ob-next').textContent = 'Next →';
    if (step === 2) {
      document.getElementById('ob-next').textContent = selectedTeam
        ? `Start following ${selectedDriver?.name.split(' ')[0] || 'them'} →`
        : 'Next →';
    }
  }

  renderDriverGrid();

  // Auto-select driver's team when moving to step 2
  function _advanceStep() {
    if (currentStep === 1 && selectedDriver) {
      // Pre-select the driver's own team
      if (!selectedTeam) selectedTeam = FALLBACK_TEAMS.find(t => t.id === selectedDriver.team) || null;
      goToStep(2);
      renderTeamGrid();
    } else if (currentStep === 2) {
      _save();
    }
  }

  async function _save() {
    const btn = document.getElementById('ob-next');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      await Profile.savePreferences({
        driverCode: selectedDriver?.code || null,
        teamId: selectedTeam?.id || null,
        complete: true,
      });
      _closeModal();
      window.dispatchEvent(new CustomEvent('profile:updated', { detail: { profile: _profile } }));
      // Navigate to My Garage
      const garageNav = document.querySelector('[data-target="garage-view"]');
      garageNav?.click();
    } catch (e) {
      console.error('[Onboarding] save error:', e);
      btn.disabled = false;
      btn.textContent = 'Try again';
    }
  }

  function _closeModal() {
    document.getElementById('onboarding-modal')?.remove();
  }

  // Event listeners
  document.getElementById('ob-next').addEventListener('click', _advanceStep);
  document.getElementById('ob-back').addEventListener('click', () => goToStep(1));
  document.getElementById('ob-skip').addEventListener('click', async () => {
    await Profile.savePreferences({ driverCode: null, teamId: null, complete: true });
    _closeModal();
  });
  document.getElementById('ob-driver-search').addEventListener('input', e => {
    renderDriverGrid(e.target.value);
  });
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

export function openProfileDrawer() {
  if (document.getElementById('profile-drawer')) return;

  _syncProfileRef();
  const profile = window.userProfile ?? _profile;
  const driver = profile ? FALLBACK_DRIVERS.find(d => d.code === profile.favorite_driver_code) : null;
  const team   = profile ? FALLBACK_TEAMS.find(t => t.id === profile.favorite_team_id) : null;
  const teamColor = TEAM_COLORS[driver?.team || team?.id] || '#E10600';

  const drawer = document.createElement('div');
  drawer.id = 'profile-drawer';
  drawer.innerHTML = `
    <div class="pd-backdrop"></div>
    <div class="pd-panel">
      <div class="pd-header">
        <span class="pd-title">Profile</span>
        <button class="pd-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      ${!profile ? `
        <div class="pd-anon">
          <div class="pd-anon-icon"><i class="fa-solid fa-user-circle"></i></div>
          <p>Sign in to save your picks, or continue as a guest.</p>
          <button class="ob-btn-next pd-full-btn" id="pd-signin-btn"><i class="fa-brands fa-google"></i> Sign In</button>
          <button class="ob-btn-skip pd-full-btn" id="pd-guest-btn">Pick a Driver as Guest</button>
        </div>
      ` : `
        <div class="pd-identity" style="--team-color:${teamColor}">
          <div class="pd-avatar" style="background:${teamColor}22;border:2px solid ${teamColor};color:${teamColor}">
            ${profile.avatar_url
              ? `<img src="${profile.avatar_url}" alt="avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
              : `<span>${(profile.display_name || 'F')[0].toUpperCase()}</span>`}
          </div>
          <div>
            <div class="pd-name">${profile.display_name || 'F1 Fan'}</div>
            <div class="pd-email">${profile.email || (profile.is_guest ? 'Guest' : '')}</div>
            ${profile.is_guest ? '<span class="pp-guest-badge">Guest</span>' : '<span class="pp-auth-badge"><i class="fa-solid fa-shield-check"></i> Auth0</span>'}
          </div>
        </div>
        <div class="pd-section">
          <div class="pp-section-title">Display Name</div>
          <div class="pd-name-edit">
            <input id="pd-name-input" type="text" class="pd-name-input" value="${profile.display_name || ''}" placeholder="Your name" maxlength="40">
            <button class="pd-name-save" id="pd-name-save-btn">Save</button>
          </div>
        </div>
        <div class="pd-section">
          <div class="pp-section-title">Favourite Driver</div>
          ${driver ? `
            <div class="pp-fav-card" style="--team-color:${teamColor}">
              <div class="pp-fav-num" style="color:${teamColor}">${driver.number}</div>
              <div>
                <div class="pp-fav-name">${driver.name}</div>
                <div class="pp-fav-team">${driver.teamName}</div>
              </div>
            </div>
          ` : `<p class="pp-empty">No driver selected.</p>`}
        </div>
        <div class="pd-section">
          <div class="pp-section-title">Favourite Team</div>
          ${team ? `
            <div class="pp-fav-card" style="--team-color:${TEAM_COLORS[team.id] || '#E10600'}">
              <div class="pp-team-dot" style="background:${TEAM_COLORS[team.id] || '#E10600'}"></div>
              <div class="pp-fav-name">${team.name}</div>
            </div>
          ` : `<p class="pp-empty">No team selected.</p>`}
        </div>
        <div class="pd-actions">
          <button class="ob-btn-next pd-full-btn" id="pd-change-btn"><i class="fa-solid fa-pen"></i> Change Driver / Team</button>
          ${profile.is_guest
            ? `<button class="pp-signin-prompt pd-full-btn" id="pd-signin-btn"><i class="fa-brands fa-google"></i> Sign in to sync</button>`
            : `<button class="ob-btn-skip pd-full-btn" id="pd-signout-btn"><i class="fa-solid fa-right-from-bracket"></i> Sign Out</button>`}
        </div>
      `}
    </div>
  `;
  document.body.appendChild(drawer);
  requestAnimationFrame(() => drawer.classList.add('pd-open'));

  const close = () => {
    drawer.classList.remove('pd-open');
    drawer.addEventListener('transitionend', () => drawer.remove(), { once: true });
  };
  drawer.querySelector('.pd-backdrop').onclick = close;
  drawer.querySelector('.pd-close').onclick = close;
  document.getElementById('pd-signin-btn')?.addEventListener('click', () => { close(); Auth.login(); });
  document.getElementById('pd-guest-btn')?.addEventListener('click', () => { close(); Profile.openOnboarding(); });
  document.getElementById('pd-change-btn')?.addEventListener('click', () => { close(); Profile.openOnboarding(); });
  document.getElementById('pd-signout-btn')?.addEventListener('click', () => {
    close();
    setTimeout(() => { if (confirm('Sign out?')) Auth.logout(); }, 200);
  });
  document.getElementById('pd-name-save-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('pd-name-input');
    const name = input?.value?.trim();
    if (!name) return;
    const btn = document.getElementById('pd-name-save-btn');
    btn.textContent = '…';
    btn.disabled = true;
    try {
      const p = window.userProfile || _profile;
      await Profile.savePreferences({
        driverCode: p?.favorite_driver_code,
        teamId: p?.favorite_team_id,
        complete: p?.onboarding_complete ?? true,
        displayName: name,
      });
      btn.textContent = '✓';
      window.dispatchEvent(new CustomEvent('profile:updated', { detail: { profile: _profile } }));
    } catch {
      btn.textContent = 'Error';
      btn.disabled = false;
    }
  });
}

// Keep a no-op export alias so any lingering import of renderProfilePage doesn't crash
export function renderProfilePage() { openProfileDrawer(); }

// ─── Bootstrap ───────────────────────────────────────────────────────────────

window.addEventListener('auth:ready', ({ detail }) => {
  if (detail.isAuthenticated) {
    Profile.load();
  } else {
    // Load guest prefs from localStorage if available
    const guest = _loadGuestProfile();
    _profile = guest || null;
    window.userProfile = _profile;
    _updateSidebarFooter(_profile);
  }
});

window.addEventListener('auth:login', () => Profile.load());

window.addEventListener('profile:updated', () => {
  // Re-render drawer if open
  if (document.getElementById('profile-drawer')) {
    document.getElementById('profile-drawer').remove();
    openProfileDrawer();
  }
});

// Hydrate guest prefs immediately so Garage / Profile don't see a null profile before auth:ready fires.
(function _bootstrapGuestProfile() {
  const guest = _loadGuestProfile();
  if (!guest) return;
  _profile = guest;
  window.userProfile = guest;
  const apply = () => _updateSidebarFooter(guest);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    queueMicrotask(apply);
  }
})();

export default Profile;
export { TEAM_COLORS, FALLBACK_DRIVERS, FALLBACK_TEAMS };
