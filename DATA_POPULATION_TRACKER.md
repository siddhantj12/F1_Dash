# F1 Data Population Tracker

Use this document to track progress populating Supabase with FastF1 data.

## Current Status (Last Updated: Mar 24, 2026)

| Table | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | Notes |
|-------|------|------|------|------|------|------|-------|
| races | 17 ✅ | 22 ✅ | 23 ✅ | 22 ✅ | 24 ✅ | 24 ✅ | Complete |
| sessions | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | 2024 R1-R12 Done |
| drivers | 20 ✅ | 20 ✅ | 20 ✅ | 20 ✅ | 20 ✅ | 20 ✅ | Complete |
| laps | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ❌ | 2024 R1-R12 Done |
| track_layouts | 17 ✅ | 22 ✅ | 22 ✅ | 22 ✅ | 24 ✅ | 22 ✅ | Complete (129 total) |
| weather | ❌ | ❌ | ❌ | ✅ | ⚠️ | ❌ | 2024 R1-R12 Done |
| telemetry | ❌ | ❌ | ❌ | 🔄 | ❌ | ❌ | **Race session only**; 2023 backfill in progress (see Phase 3) |

**Supabase schema (Mar 2026):** Production `telemetry` must match ETL/API: `telemetry.timestamp` is **`double precision`** (seconds into lap), not SQL `timestamp`. RPC: `supabase/sql/telemetry_functions.sql`. Extra columns (`distance`, `x`, `y`, `z`, `rpm`, `drs`) must exist—see `supabase/sql/full_schema.sql`.

---

## 🛠 Unified ETL Command (RECOMMENDED)

The unified script (`scripts/populate_all.py`) fills laps, weather, track layouts, and **Race-session telemetry** (telemetry is skipped for FP/Qual by design to limit volume). It skips rows that already exist (including per-lap telemetry).

```bash
# One year, with telemetry (default sample rate 1/10)
python scripts/populate_all.py --year 2023

# Single race weekend
python scripts/populate_all.py --year 2023 --round 5

# Denser telemetry (more rows in DB)
python scripts/populate_all.py --year 2023 --telemetry-sample-rate 5

# Laps / weather / layouts only—no telemetry (faster)
python scripts/populate_all.py --year 2024 --skip-telemetry

# All configured years (2020–2025)—long-running
python scripts/populate_all.py

# Row counts (including telemetry total)
python scripts/check_data_status.py
```

**Backfill remaining telemetry:** Run the script **per year** (or rely on the full run) **without** `--skip-telemetry`. Order does not matter across years; re-runs are safe (existing lap telemetry is skipped). Prefer off-peak hours for multi-year runs—FastF1 download + inserts are heavy.

---

## Roadmap & Missing Data

### Phase 1: Infrastructure & Schema ✅ COMPLETE
- [x] Unified "Source of Truth" schema (`supabase/sql/full_schema.sql`)
- [x] Dependencies fixed (`supabase`, `fastf1`, `httpx` versioning)
- [x] Legacy ETL scripts archived

### Phase 2: Weather & Laps (Filling the Gaps) 🔄 IN PROGRESS
- [x] **2023**: All laps and weather populated ✅
- [ ] **2020**: Weather data (17 races × 5 sessions)
- [ ] **2021**: Weather data (22 races × 5 sessions)
- [ ] **2022**: Weather data (22 races × 5 sessions)
- [ ] **2024**: Laps & Weather (24 races × 5 sessions)
- [ ] **2025**: Laps & Weather (24 races × 5 sessions)

### Phase 3: Telemetry (High Volume) 🔄 IN PROGRESS
- [x] Sampling rate: **`--telemetry-sample-rate`** (default **10** ≈ 1/10 FastF1 samples)
- [x] ETL uses merged `get_telemetry()` + `telemetry.timestamp` as float seconds; `rpc_get_lap_telemetry` deployed
- [x] DB: `telemetry.timestamp` column type = **`double precision`** (lap seconds)
- [ ] **2023**: finish Race telemetry for all rounds (if not done)
- [ ] **2020–2022, 2024–2025**: Race telemetry backfill year by year or `python scripts/populate_all.py` (no `--skip-telemetry`)

---

## Verification Queries (Supabase SQL Editor)

```sql
-- Check session and weather counts
SELECT r.year, COUNT(s.id) as sessions, COUNT(w.id) as weather_records
FROM races r
LEFT JOIN sessions s ON s.race_id = r.id
LEFT JOIN weather w ON w.session_id = s.id
GROUP BY r.year
ORDER BY r.year;
```

```sql
-- Telemetry points rows by season (Race laps only in practice)
SELECT r.year, COUNT(t.id) AS telemetry_points
FROM telemetry t
JOIN laps l ON l.id = t.lap_id
JOIN sessions s ON s.id = l.session_id
JOIN races r ON r.id = s.race_id
GROUP BY r.year
ORDER BY r.year;
```

---

## Notes
- **Source of Truth**: Always use `scripts/populate_all.py`. Avoid legacy `etl/` scripts.
- **Cache**: FastF1 data is cached in `fastf1_cache/` to speed up subsequent runs.
- **Incremental**: Scripts automatically skip records that already exist in Supabase.
- **Last action**: Telemetry pipeline validated (schema + ETL + RPC); **2023 Race telemetry backfill** underway—extend to all years with `populate_all.py` without `--skip-telemetry`.
