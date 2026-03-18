# F1 Data Population Tracker

Use this document to track progress populating Supabase with FastF1 data.

## Current Status

| Table | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | Notes |
|-------|------|------|------|------|------|------|-------|
| races | 17 ✅ | 22 ✅ | 23 ✅ | 22 ✅ | 24 ✅ | 24 ✅ | Complete |
| sessions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ~5 per race |
| drivers | 20 ✅ | 20 ✅ | 20 ✅ | 20 ✅ | 20 ✅ | 20 ✅ | Complete |
| laps | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | Partial |
| track_layouts | 17 ✅ | 22 ✅ | 22 ✅ | 22 ✅ | 24 ✅ | 22 ✅ | Complete |
| weather | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Not started |
| telemetry | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Not started (large) |

---

## Scripts & Commands

### Check Current Counts
```bash
cd F1_Dash
.\venv\Scripts\Activate.ps1
python scripts/check_data_status.py
```

### Populate by Year
```bash
# Track layouts (one year at a time)
python scripts/populate_year.py --year 2022 --table track_layouts

# Weather (one year at a time)
python scripts/populate_year.py --year 2020 --table weather

# Laps (one year at a time)
python scripts/populate_year.py --year 2023 --table laps
```

---

## Checklist

### Phase 1: Track Layouts ✅ COMPLETE
- [x] 2020: 17 tracks ✅ (Completed)
- [x] 2021: 22 tracks ✅ (Completed)
- [x] 2022: 22 tracks ✅ (Completed)
- [x] 2023: 22 tracks ✅ (Completed)
- [x] 2024: 24 tracks ✅ (Completed)
- [x] 2025: 22 tracks ✅ (Completed)

**Total: 129 track layouts across all years**

### Phase 2: Weather 🔄 IN PROGRESS
- [ ] 2020 (17 races × 5 sessions)
- [ ] 2021 (22 races × 5 sessions)
- [ ] 2022 (22 races × 5 sessions)
- [ ] 2023 (22 races × 5 sessions)
- [ ] 2024 (24 races × 5 sessions)
- [ ] 2025 (24 races × 5 sessions)

### Phase 3: Laps (fill gaps)
- [ ] Verify 2020-2022 complete
- [ ] 2023 all
- [ ] 2024 all
- [ ] 2025 all

### Phase 4: Telemetry (optional, large)
- [ ] Decide sampling rate
- [ ] 2020 Race sessions only
- [ ] 2021 Race sessions only
- [ ] etc.

---

## Verification Queries

Run in Supabase SQL Editor:

```sql
-- Count by table and year
SELECT 'races' as tbl, year, COUNT(*) FROM races GROUP BY year
UNION ALL
SELECT 'drivers', year, COUNT(*) FROM drivers GROUP BY year
UNION ALL
SELECT 'track_layouts', year, COUNT(*) FROM track_layouts GROUP BY year
ORDER BY tbl, year;
```

---

## Notes

- Ergast API (used by FastF1 for schedules) sometimes goes down
- If API fails, wait 30 min and retry
- Scripts are incremental - they skip existing data
- Update this tracker after each successful run
- **Last updated**: Track layouts completed for all years (2020-2025)
- **Current focus**: Weather data population

