# F1 Data Population Tracker

Use this document to track progress populating Supabase with FastF1 data.

## Current Status (Last Updated: Mar 18, 2026)

| Table | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | Notes |
|-------|------|------|------|------|------|------|-------|
| races | 17 ✅ | 22 ✅ | 23 ✅ | 22 ✅ | 24 ✅ | 24 ✅ | Complete |
| sessions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ~5 per race |
| drivers | 20 ✅ | 20 ✅ | 20 ✅ | 20 ✅ | 20 ✅ | 20 ✅ | Complete |
| laps | ✅ | ✅ | ⚠️ | ✅ | ❌ | ❌ | 2023 Done (196k total) |
| track_layouts | 17 ✅ | 22 ✅ | 22 ✅ | 22 ✅ | 24 ✅ | 22 ✅ | Complete (129 total) |
| weather | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | 2023 Done (291 total) |
| telemetry | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Not started (large) |

---

## 🛠 Unified ETL Command (RECOMMENDED)

The new unified script handles all tables incrementally. Use this for all future population tasks:

```bash
# Populate a specific year (excluding telemetry)
python scripts/populate_all.py --year 2024 --skip-telemetry

# Populate a single race round
python scripts/populate_all.py --year 2024 --round 1 --skip-telemetry

# Check status
python scripts/check_data_status.py
```

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

### Phase 3: Telemetry (Optional, High Volume)
- [ ] Decide sampling rate (currently 1/10th in `populate_all.py`)
- [ ] 2020-2025 Race sessions only (Telemetry for practice is usually skipped)

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

---

## Notes
- **Source of Truth**: Always use `scripts/populate_all.py`. Avoid legacy `etl/` scripts.
- **Cache**: FastF1 data is cached in `fastf1_cache/` to speed up subsequent runs.
- **Incremental**: Scripts automatically skip records that already exist in Supabase.
- **Last action**: 2023 Full Population (Laps + Weather) completed successfully.
