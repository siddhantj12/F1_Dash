# PRD: Auth0 Authentication & Personalized F1 Fan Experience

**Version:** 0.2 — Revised
**Date:** 2026-04-08
**Author:** Siddhant Jain
**Status:** Approved for implementation

---

## 1. Problem Statement

The app has no real authentication and no concept of a user. Every visitor sees identical, impersonal data. F1 fans are deeply attached to specific drivers and teams — a fan should open the app and immediately see their driver's telemetry, season arc, upcoming race, and relevant news without hunting for it every session. This PRD covers (a) real auth via Auth0, (b) a first-login onboarding flow to capture their favorite driver and team, and (c) three personalized surfaces: a "My Garage" page, a 2026 season calendar, and a favorite-aware news feed.

---

## 2. Goals & Non-Goals

### Goals
- Auth via Auth0 (Google OAuth + email/password); anonymous browsing still works
- First-login onboarding: pick favorite driver (with photo) + favorite team from the 2026 roster
- **My Garage** page: a dedicated, exclusive view of the user's favorite driver's 2026 season performance
- **Calendar** page: full 2026 F1 season calendar with race status (upcoming / completed / live)
- Favorite-aware defaults everywhere: telemetry, news ranking, standings highlights
- User profile persisted in Supabase; JWT validated on the backend via Auth0 JWKS

### Non-Goals (v1)
- Multiple favorites per user
- Social / friend comparison features
- Push or email notifications
- Native mobile apps
- Changing favorites (Settings page is post-launch)

---

## 3. Auth Providers

| Provider | Notes |
|----------|-------|
| Google OAuth 2.0 | Primary — one-click sign-in |
| Email + Password | Auth0 DB connection |

---

## 4. User Stories

| # | As a… | I want to… | So that… |
|---|-------|-----------|----------|
| 1 | First-time visitor | Sign up with Google in one click | No form to fill |
| 2 | New user | Pick my favorite driver and team right after signing up | The app feels mine from day one |
| 3 | Returning user | Land directly on My Garage | I immediately see how my driver is doing |
| 4 | Fan | See a full 2026 race calendar with status | I know when the next race is |
| 5 | Fan | See news about my driver/team ranked first | I don't miss relevant stories |
| 6 | Fan | See my driver highlighted in standings | I track their season position at a glance |
| 7 | Anonymous visitor | Browse telemetry and news without signing in | I can evaluate the app before committing |

---

## 5. User Flows

### 5.1 Sign-Up / First Login

```
Landing Page (anonymous)
        │
        ├──> [Sign In button — top right]
        │           │
        │     Auth0 Universal Login
        │     (Google OAuth | Email + Password)
        │           │
        │     ┌─────▼────────────────────────────┐
        │     │  Is this user's first login?     │
        │     │  (onboarding_complete = false)   │
        │     └─────┬────────────────────────────┘
        │           │ YES                      NO
        │           ▼                           ▼
        │   Onboarding Modal              My Garage (default landing
        │   Step 1: Pick Driver           for logged-in users)
        │   Step 2: Pick Team
        │   [Start Following →]
        │           │
        │           ▼
        │     My Garage (personalized)
        │
        └──> [Continue as guest] ──> Telemetry (generic defaults)
```

### 5.2 Returning User

```
Page load → Auth0 silent auth check
        │
        ├── Token valid → fetch /api/me → inject userProfile → show My Garage
        └── No token   → show Telemetry (anonymous default)
```

---

## 6. Feature Specifications

### 6.1 Auth0 Integration

**Auth flow:** Auth0 Universal Login with silent token refresh (auth0-spa-js SDK).

**Token strategy:**
- Access token stored in memory only (not localStorage) to reduce XSS surface
- Backend validates JWT on protected endpoints using Auth0 JWKS endpoint
- Anonymous users can access all read-only endpoints; protected endpoints (`/api/me`, `/api/me/preferences`) return `401` which the UI handles gracefully

**New/changed backend endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/me` | Required | Return authenticated user's profile + favorites |
| PUT | `/api/me/preferences` | Required | Update favorite_driver_code + favorite_team_id |
| ~~POST~~ | ~~`/api/token`~~ | — | Remove fake stub |

**Auth0 tenant setup (new tenant required):**
1. Create account at auth0.com
2. Create Application → Single Page Application → Name: "F1 Dashboard"
3. Enable connections: Google OAuth, Username-Password-Authentication
4. Set Allowed Callback URLs: `http://localhost:8002, http://localhost:8002/callback`
5. Set Allowed Logout URLs + Allowed Web Origins: same
6. Note: `Domain`, `Client ID` — add to `.env` as `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`
7. Create an API → Identifier: `https://f1dashboard.api` → set as `AUTH0_AUDIENCE`

**New env vars:**
```
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=xxxxx
AUTH0_AUDIENCE=https://f1dashboard.api
```

**New frontend files:**
- `static/js/auth.js` — Auth0 SPA client init, `login()`, `logout()`, `getToken()`, silent auth on load
- `static/js/profile.js` — Fetch `/api/me`, trigger onboarding modal, expose `window.userProfile`

**New backend files:**
- `src/middleware/auth0.py` — Validate Bearer JWT against Auth0 JWKS; inject `request.state.user_sub`
- `src/routers/profile.py` — `GET /api/me` + `PUT /api/me/preferences`

---

### 6.2 Supabase Schema: `user_profiles`

```sql
CREATE TABLE user_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth0_sub             TEXT UNIQUE NOT NULL,
  email                 TEXT,
  display_name          TEXT,
  avatar_url            TEXT,
  favorite_driver_code  TEXT,      -- e.g. "VER", "NOR", "HAM"
  favorite_team_id      TEXT,      -- e.g. "red_bull", "mclaren"
  onboarding_complete   BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: users can only read/write their own row
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_profile" ON user_profiles
  USING (auth0_sub = current_setting('app.current_user_sub', true));
```

---

### 6.3 First-Login Onboarding Modal

**Trigger:** authenticated user with `onboarding_complete = false`.

**Step 1 — Pick Your Driver**
- Full-screen modal overlay with F1-themed dark background
- Grid of driver cards (3–4 columns) pulled from `/api/drivers/2026/R`
- Each card shows:
  - Official driver headshot (sourced from F1's CDN: `media.formula1.com/image/upload/f_auto/q_auto/v1677244953/content/dam/fom-website/drivers/{FirstnameLastname}/{number}.png`)
  - Fallback: generated avatar using driver's team color + initials
  - Driver number (large, team-colored)
  - Full name
  - Team name
  - Team color accent on card border
- Single-select; selected card gets glowing team-colored border + checkmark
- Search bar to filter by name

**Step 2 — Pick Your Team**
- Grid of constructor cards
- Each card: team logo (if available), team name, primary color swatch
- Derived from 2026 constructor list
- Single-select

**CTA:** "Start Following [Driver First Name] →"
- On submit: `PUT /api/me/preferences` → `onboarding_complete = true` → close modal → navigate to My Garage

**Skip:** "I'll decide later" link (small, bottom of modal)
- Sets `onboarding_complete = true` with null favorites
- Navigates to Telemetry (generic default)

---

### 6.4 My Garage Page (NEW)

**Navigation:** "My Garage" item in sidebar (replace or add after Telemetry). Visible to all users; shows a "Sign in to personalize" prompt for anonymous users.

**Layout — logged in with favorites set:**

```
┌─────────────────────────────────────────────────────────────┐
│  [Driver Photo]  MAX VERSTAPPEN  #1  Red Bull Racing        │
│  Current Championship Position: P2 | Points: 87            │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────────────────┐
│ 2026 SEASON RESULTS  │  │ CHAMPIONSHIP STANDING CHART      │
│ Round 1: P3  +15 pts │  │ Points over rounds (line chart)  │
│ Round 2: DNF  +0 pts │  │ vs. championship leader          │
│ Round 3: P1  +25 pts │  │                                  │
│ ...                  │  │                                  │
└──────────────────────┘  └──────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ RECENT TELEMETRY  [Load Last Race Lap →]                    │
│ (links directly into Telemetry view pre-filtered to driver) │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ LATEST NEWS  (top 3 articles mentioning driver/team)        │
└──────────────────────────────────────────────────────────────┘
```

**Data sources:**
- Season results: `/api/races/2026` + standings endpoint (or Ergast/OpenF1 API for 2026 data)
- Points chart: accumulated per round from results
- Recent telemetry: deep-link to Telemetry view with `?driver=VER&year=2026`
- News: filtered from existing `/api/news` endpoint by driver name + team name

**State for anonymous users:**
- Show hero section with generic F1 imagery
- CTA: "Sign in and pick your driver to unlock My Garage"

---

### 6.5 Calendar Page (REVAMP)

**Navigation:** Existing "Calendar" sidebar item (currently stub) — wire up properly.

**Data:** Hard-coded 2026 F1 World Championship calendar (24 rounds). Supplement with live status from OpenF1 or Ergast when available.

**2026 Season Calendar:**

| Round | Race | Circuit | Date |
|-------|------|---------|------|
| 1 | Australian GP | Melbourne | 15 Mar 2026 |
| 2 | Chinese GP | Shanghai | 22 Mar 2026 |
| 3 | Japanese GP | Suzuka | 5 Apr 2026 |
| 4 | Bahrain GP | Sakhir | 19 Apr 2026 |
| 5 | Saudi Arabian GP | Jeddah | 26 Apr 2026 |
| 6 | Miami GP | Miami | 10 May 2026 |
| 7 | Emilia Romagna GP | Imola | 24 May 2026 |
| 8 | Monaco GP | Monaco | 31 May 2026 |
| 9 | Spanish GP | Barcelona | 14 Jun 2026 |
| 10 | Canadian GP | Montreal | 21 Jun 2026 |
| 11 | Austrian GP | Red Bull Ring | 5 Jul 2026 |
| 12 | British GP | Silverstone | 12 Jul 2026 |
| 13 | Belgian GP | Spa-Francorchamps | 26 Jul 2026 |
| 14 | Hungarian GP | Budapest | 2 Aug 2026 |
| 15 | Dutch GP | Zandvoort | 30 Aug 2026 |
| 16 | Italian GP | Monza | 6 Sep 2026 |
| 17 | Azerbaijan GP | Baku | 20 Sep 2026 |
| 18 | Singapore GP | Marina Bay | 27 Sep 2026 |
| 19 | United States GP | Austin | 18 Oct 2026 |
| 20 | Mexico City GP | Mexico City | 25 Oct 2026 |
| 21 | São Paulo GP | Interlagos | 8 Nov 2026 |
| 22 | Las Vegas GP | Las Vegas | 21 Nov 2026 |
| 23 | Qatar GP | Lusail | 29 Nov 2026 |
| 24 | Abu Dhabi GP | Yas Marina | 6 Dec 2026 |

**Card design per race:**
- Round number badge
- Country flag emoji
- Race name + circuit name
- Date (formatted: "15 Mar")
- **Status pill:**
  - `COMPLETED` (gray) — race date < today
  - `NEXT RACE` (red, pulsing) — nearest upcoming round
  - `UPCOMING` (white) — future rounds
  - `LIVE` (green, pulsing) — race weekend in progress (Fri–Sun)
- If user is logged in + has favorite driver: show that driver's result for completed rounds (e.g., "VER — P2")
- Clicking a completed race: deep-links to Telemetry view pre-loaded with that race + favorite driver

**Layout:** Vertical timeline list on left; large map/circuit graphic on right (or just cards in a 2-col grid for v1).

---

### 6.6 Favorite-Aware Personalization (Other Surfaces)

| Surface | Anonymous | Personalized |
|---------|-----------|-------------|
| **Telemetry** | No default | Pre-selects favorite driver + most recent race |
| **Driver standings** | Plain list | Favorite driver row: team-colored highlight + star |
| **Constructor standings** | Plain list | Favorite team row: highlighted |
| **News feed** | Chronological | Articles mentioning driver/team floated to top; tagged with "Your Driver" / "Your Team" pill |
| **Live positions** | Generic dots | Favorite driver dot: larger + team-colored |
| **Sidebar user area** | "F1 Fan" generic | Driver name + number + team color accent |

---

## 7. Technical Architecture

```
Browser
  ├── auth0-spa-js SDK
  │     └── login redirect, silent refresh, token storage (memory)
  ├── static/js/auth.js         (NEW) — Auth0 init, login(), logout(), getToken()
  ├── static/js/profile.js      (NEW) — /api/me fetch, onboarding modal, window.userProfile
  ├── static/js/garage.js       (NEW) — My Garage page rendering
  ├── static/js/calendar.js     (NEW) — 2026 calendar data + rendering
  └── static/js/app.js          (MODIFIED) — read window.userProfile for defaults + highlights

FastAPI backend
  ├── src/middleware/auth0.py   (NEW) — JWKS validation, inject user_sub
  ├── src/routers/profile.py    (NEW) — GET /api/me, PUT /api/me/preferences
  └── src/routers/auth.py       (REPLACE) — remove fake token; keep OAuth2 scheme for Swagger

Supabase
  └── user_profiles             (NEW table) — RLS: auth0_sub matches JWT sub

Auth0 Tenant
  └── SPA Application: "F1 Dashboard"
      ├── Connections: Google, Username-Password-Authentication
      └── API: identifier = https://f1dashboard.api
```

---

## 8. Implementation Milestones

| Milestone | Deliverables |
|-----------|-------------|
| **M1 — Auth Scaffold** | Auth0 tenant setup guide; `auth.js` with login/logout/silent auth; Login button + user avatar in topbar; backend JWT middleware; `/api/me` stub returning profile |
| **M2 — Profile Storage** | Supabase `user_profiles` migration; `PUT /api/me/preferences`; RLS policies |
| **M3 — Onboarding Modal** | Driver picker grid with photos (2026 roster); team picker; save → onboarding_complete; skip flow |
| **M4 — Calendar Page** | Full 2026 calendar with status pills; completed-race result overlay for logged-in users; deep-link to telemetry |
| **M5 — My Garage** | Season results table; points chart; telemetry shortcut; news highlights; anonymous CTA state |
| **M6 — Personalized Surfaces** | Telemetry defaults; standings highlights; news re-ranking; live position dot; sidebar user area |

---

## 9. Open Questions (Resolved)

| # | Question | Resolution |
|---|----------|------------|
| 1 | Auth0 tenant | New tenant — create fresh. Setup steps in M1. |
| 2 | Auth providers | Google OAuth + Email/Password only |
| 3 | Driver data source | Pull live from `/api/drivers/2026/R`; fall back to hard-coded 2026 roster |
| 4 | Driver photos | F1 CDN (`media.formula1.com`) with initials-avatar fallback |
| 5 | Changing favorites | Post-launch (Settings page not in v1 scope) |
| 6 | Multiple devices | Profile server-side → auto-synced; no extra work needed |

---

## 10. Success Metrics

| Metric | Target (60 days post-launch) |
|--------|------------------------------|
| Signup conversion (visitor → account) | > 25% |
| Onboarding completion rate | > 80% of sign-ups |
| D7 retention uplift (logged-in vs anonymous) | +20pp |
| My Garage sessions per logged-in user / week | > 3 |
| Calendar page views / race weekend | > 50% of DAU |
