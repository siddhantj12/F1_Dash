# F1 Telemetry Dashboard - Supabase Database Migration Requirements

## Executive Summary

This document outlines the requirements for migrating the F1 Telemetry Dashboard from a real-time data processing architecture to a Supabase-powered database architecture. The goal is to dramatically improve API performance, scalability, and user experience by moving from on-demand data processing to pre-processed, cached data storage.

## Current Architecture Analysis

### Current Issues
- **Performance Bottleneck**: Every API request triggers FastF1 data fetching and heavy computational processing
- **Heavy Computational Load**: Acceleration calculations, data cleaning, and telemetry processing happen on each request
- **Limited Scalability**: Redis cache helps but requires initial processing for each unique request
- **Inconsistent Response Times**: Complex queries and data processing lead to variable API response times
- **Resource Intensive**: High CPU and memory usage during data processing

### Current Data Flow
1. API Request → FastF1 API Call → Data Processing → Response
2. Telemetry processing includes acceleration calculations, data cleaning, and JSON serialization
3. Redis provides temporary caching with 1-hour TTL

## Target Architecture

### Proposed Solution
Move from real-time processing to a pre-processed data warehouse approach using Supabase PostgreSQL database with optimized queries and caching.

### Benefits
- **10-100x Faster API Responses**: Query pre-processed data instead of computing on-demand
- **Improved Scalability**: Handle increased concurrent users without performance degradation
- **Better Data Consistency**: Centralized data storage with proper indexing
- **Reduced Server Load**: Minimal computation per request
- **Enhanced User Experience**: Consistent, fast response times

## Database Schema Requirements

### Core Tables

#### 1. Seasons Table
```sql
CREATE TABLE seasons (
    id SERIAL PRIMARY KEY,
    year INTEGER UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```
- Stores available F1 seasons (2018-2025)
- Minimal data, rarely changes

#### 2. Races Table
```sql
CREATE TABLE races (
    id SERIAL PRIMARY KEY,
    season_id INTEGER REFERENCES seasons(id),
    round_number INTEGER NOT NULL,
    event_name TEXT NOT NULL,
    circuit_name TEXT NOT NULL,
    event_date DATE NOT NULL,
    circuit_key INTEGER,
    location TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(season_id, round_number)
);
```
- Stores race information for each season
- Links to circuit information

#### 3. Sessions Table
```sql
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    race_id INTEGER REFERENCES races(id),
    session_type TEXT NOT NULL, -- 'Practice 1', 'Practice 2', 'Practice 3', 'Qualifying', 'Race', 'Sprint'
    session_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(race_id, session_type)
);
```
- Stores session information for each race

#### 4. Drivers Table
```sql
CREATE TABLE drivers (
    id SERIAL PRIMARY KEY,
    driver_code TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    team_name TEXT NOT NULL,
    team_color TEXT,
    season_year INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(driver_code, season_year)
);
```
- Stores driver information with team colors
- Season-specific to handle team changes

#### 5. Laps Table
```sql
CREATE TABLE laps (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id),
    driver_id INTEGER REFERENCES drivers(id),
    lap_number INTEGER NOT NULL,
    lap_time_seconds DECIMAL(10,3),
    sector1_time_seconds DECIMAL(10,3),
    sector2_time_seconds DECIMAL(10,3),
    sector3_time_seconds DECIMAL(10,3),
    compound TEXT,
    stint INTEGER,
    tyre_life INTEGER,
    position INTEGER,
    track_status TEXT,
    is_personal_best BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(session_id, driver_id, lap_number)
);
```
- Stores lap-by-lap data for each driver in each session
- Pre-calculates time values in seconds for faster queries

#### 6. Telemetry Data Table
```sql
CREATE TABLE telemetry_data (
    id SERIAL PRIMARY KEY,
    lap_id INTEGER REFERENCES laps(id),
    time_seconds DECIMAL(10,3) NOT NULL,
    speed_kmh DECIMAL(6,2),
    rpm INTEGER,
    gear INTEGER,
    throttle DECIMAL(5,2),
    brake DECIMAL(5,2),
    drs INTEGER, -- 0 or 1
    distance DECIMAL(10,3),
    relative_distance DECIMAL(6,4),
    x_position DECIMAL(10,3),
    y_position DECIMAL(10,3),
    z_position DECIMAL(10,3),
    acceleration_x DECIMAL(8,3),
    acceleration_y DECIMAL(8,3),
    acceleration_z DECIMAL(8,3),
    created_at TIMESTAMP DEFAULT NOW()
);
```
- Stores pre-processed telemetry data points
- Includes all calculated values (accelerations, cleaned data)
- Optimized for time-series queries

#### 7. Circuit Information Table
```sql
CREATE TABLE circuit_info (
    id SERIAL PRIMARY KEY,
    race_id INTEGER REFERENCES races(id),
    corner_number INTEGER NOT NULL,
    x_position DECIMAL(10,3) NOT NULL,
    y_position DECIMAL(10,3) NOT NULL,
    angle DECIMAL(6,3),
    distance DECIMAL(10,3),
    rotation DECIMAL(6,3),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(race_id, corner_number)
);
```
- Stores circuit corner information for track visualization

## API Performance Optimizations

### Current vs Target Response Times

| Endpoint | Current (avg) | Target (avg) | Improvement |
|----------|---------------|--------------|-------------|
| `/api/seasons` | 50ms | 10ms | 5x faster |
| `/api/races/{year}` | 200-500ms | 20ms | 10-25x faster |
| `/api/drivers/{year}/{round}/{session}` | 300-800ms | 30ms | 10-27x faster |
| `/api/laps/{year}/{round}/{session}/{driver}` | 500-2000ms | 50ms | 10-40x faster |
| `/api/telemetry/{year}/{round}/{session}/{driver}/{lap}` | 1000-5000ms | 100ms | 10-50x faster |

### Query Optimizations

#### 1. Materialized Views for Common Queries
```sql
CREATE MATERIALIZED VIEW driver_session_summary AS
SELECT
    d.driver_code,
    d.team_name,
    s.session_type,
    r.event_name,
    r.round_number,
    COUNT(l.id) as total_laps,
    MIN(l.lap_time_seconds) as best_lap_time,
    AVG(l.lap_time_seconds) as avg_lap_time
FROM drivers d
JOIN laps l ON d.id = l.driver_id
JOIN sessions s ON l.session_id = s.id
JOIN races r ON s.race_id = r.id
GROUP BY d.driver_code, d.team_name, s.session_type, r.event_name, r.round_number;
```

#### 2. Optimized Indexes
```sql
-- Composite indexes for common query patterns
CREATE INDEX idx_laps_session_driver ON laps(session_id, driver_id);
CREATE INDEX idx_laps_time ON laps(lap_time_seconds);
CREATE INDEX idx_telemetry_lap_time ON telemetry_data(lap_id, time_seconds);
CREATE INDEX idx_drivers_season_team ON drivers(season_year, team_name);
```

#### 3. Partitioning Strategy
```sql
-- Partition telemetry data by season for better performance
CREATE TABLE telemetry_data_y2024 PARTITION OF telemetry_data FOR VALUES IN (2024);
CREATE TABLE telemetry_data_y2023 PARTITION OF telemetry_data FOR VALUES IN (2023);
-- Add partitions for other years as needed
```

## Data Migration Strategy

### Phase 1: Schema Setup (Week 1)
- [ ] Create Supabase project and configure connection
- [ ] Design and implement database schema
- [ ] Set up Row Level Security (RLS) policies
- [ ] Create database functions and triggers
- [ ] Set up automated backups

### Phase 2: Data Migration (Week 2-3)
- [ ] Develop data migration scripts
- [ ] Migrate historical data (2018-2024)
- [ ] Implement incremental data updates for current season
- [ ] Set up data validation and quality checks
- [ ] Performance testing with migrated data

### Phase 3: API Refactoring (Week 4)
- [ ] Refactor API endpoints to use Supabase queries
- [ ] Implement connection pooling
- [ ] Add query result caching at application level
- [ ] Update error handling for database operations
- [ ] Performance optimization and testing

### Phase 4: ETL Pipeline Modernization (Week 5)
- [ ] Modify existing ETL to write to Supabase instead of files
- [ ] Implement data freshness tracking
- [ ] Set up automated data refresh schedules
- [ ] Add data quality monitoring
- [ ] Implement rollback mechanisms

## Infrastructure Requirements

### Supabase Configuration
- **Plan**: Pro plan minimum for better performance and larger databases
- **Database Size**: Estimate 50-100GB for 2018-2025 data
- **Backup Strategy**: Point-in-time recovery enabled
- **Monitoring**: Database performance monitoring enabled

### Application Changes
- **Connection Management**: Implement connection pooling
- **Error Handling**: Add database-specific error handling
- **Logging**: Enhanced logging for database operations
- **Caching**: Hybrid Redis + Supabase caching strategy

## Performance Monitoring

### Key Metrics to Track
- API response times (target: <100ms for all endpoints)
- Database query performance
- Cache hit rates
- Data freshness indicators
- Error rates and types

### Alerting Strategy
- Response time > 500ms for any endpoint
- Database connection failures
- Failed data migrations
- High error rates (>1%)

## Risk Mitigation

### Rollback Strategy
- Maintain current file-based system as backup during transition
- Gradual rollout with feature flags
- Database backup before major changes

### Data Consistency
- Implement data validation checks
- Cross-reference with FastF1 API during migration
- Regular data integrity audits

### Performance Degradation
- Load testing before full deployment
- Gradual traffic migration
- Performance benchmarking against current system

## Success Criteria

### Performance Goals
- [ ] All API endpoints respond in <100ms average
- [ ] Support 100+ concurrent users without performance degradation
- [ ] 99.9% uptime for database operations
- [ ] Zero data loss during migration

### User Experience
- [ ] Faster page load times
- [ ] Consistent response times across all features
- [ ] Improved data visualization performance
- [ ] Better comparison feature performance

## Cost Estimation

### Supabase Costs (Monthly)
- **Database**: $25-50 (Pro plan)
- **Storage**: $10-20 for 100GB
- **Bandwidth**: $5-10
- **Total**: $40-80/month

### Development Costs
- **Migration Development**: 4-5 weeks of development time
- **Testing and Optimization**: 1-2 weeks
- **Total**: 5-7 weeks of engineering effort

## Next Steps

1. **Immediate Actions**
   - Set up Supabase project and test basic connectivity
   - Begin schema design and review
   - Start data migration planning

2. **Short-term Goals (Next 2 weeks)**
   - Complete schema implementation
   - Begin data migration for test data
   - Set up monitoring and alerting

3. **Medium-term Goals (Next 2 months)**
   - Complete full data migration
   - Refactor all API endpoints
   - Performance testing and optimization

This migration will transform the F1 Telemetry Dashboard from a computationally expensive, slow-responding application into a high-performance, scalable platform that can handle significant user growth while providing an excellent user experience.





