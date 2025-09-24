Refactor and clean up this F1 Dashboard codebase to make it more comprehensive, maintainable, and professional while retaining all current functionality. The codebase is a Formula 1 telemetry dashboard built with FastAPI backend and vanilla JavaScript frontend that visualizes F1 race data and allows driver comparisons using the FastF1 Python library. Run `coderabbit review --plain` to get comprehensive code analysis and improvement suggestions. Apply the feedback to write cleaner, more maintainable code.

## Current Codebase Structure
```
F1_Dash/
├── src/
│   ├── routers/          # FastAPI route handlers
│   ├── models/           # Pydantic data models  
│   ├── services/         # Business logic services
│   ├── utils/            # Utility functions
│   ├── etl/              # Data extraction scripts
│   └── cache.py          # Redis caching implementation
├── static/               # Frontend assets (HTML/CSS/JS)
├── etl/                  # Additional ETL scripts (needs consolidation)
├── scripts/              # Utility and migration scripts
└── fastf1_cache/         # FastF1 data cache directory
```

## Specific Areas Requiring Cleanup

### 1. Code Organization & Architecture
- **Evaluate current project structure**: Assess if the current `src/` directory organization is optimal
- **Identify architectural improvements**: Look for opportunities to implement better separation of concerns
- **Suggest modular improvements**: Recommend ways to make the codebase more modular and maintainable
- **Review dependency management**: Analyze the current dependency structure and suggest optimizations

### 2. Code Quality & Best Practices
- **Python code standards**: Ensure PEP 8 compliance and modern Python best practices
- **Type hints**: Add comprehensive type annotations where missing
- **Error handling**: Improve exception handling and error propagation
- **Logging**: Standardize logging practices across the application
- **Documentation**: Add docstrings and inline comments for better code comprehension
- **Code duplication**: Identify and suggest refactoring for duplicate code patterns

### 3. Performance & Scalability
- **Caching strategy**: Review Redis caching implementation and suggest improvements
- **Database operations**: Optimize Supabase queries and data operations
- **Memory usage**: Identify potential memory leaks or inefficient data handling
- **Async/await patterns**: Ensure proper async implementation throughout the codebase
- **FastF1 data handling**: Optimize telemetry data processing and storage

### 4. Security & Configuration
- **Environment variables**: Ensure sensitive data is properly handled via environment variables
- **Input validation**: Strengthen API input validation and sanitization
- **CORS configuration**: Review and optimize CORS settings
- **Authentication**: Assess current auth implementation and suggest improvements
- **Configuration management**: Review the settings/config pattern

### 5. Testing & Reliability
- **Test coverage**: Identify areas lacking proper test coverage
- **Test quality**: Review existing tests and suggest improvements
- **Error scenarios**: Ensure robust handling of edge cases and failure modes
- **Data validation**: Strengthen data model validation

### 6. Frontend Code Quality
- **JavaScript organization**: Improve code structure in `static/js/` files
- **API integration**: Optimize frontend-backend communication
- **Error handling**: Improve frontend error handling and user feedback
- **Code maintainability**: Suggest improvements for better maintainability

### 7. DevOps & Deployment
- **Docker configuration**: Review Dockerfile and docker-compose.yml for best practices
- **Build process**: Optimize build scripts and deployment pipeline
- **Environment setup**: Improve development environment setup process
- **Dependency management**: Review requirements.txt and suggest version pinning strategies

## Specific Areas of Focus

### High Priority Issues to Address:
1. **ETL Scripts Organization**: The `etl/` directory contains many similar scripts - suggest consolidation and better organization
2. **Cache Implementation**: Review the Redis cache implementation in `src/cache.py` for potential improvements
3. **Router Structure**: Analyze the FastAPI router organization and suggest improvements
4. **Data Models**: Review and enhance the Pydantic models in `src/models/models.py`
5. **Error Handling**: Standardize error handling across all API endpoints
6. **Configuration Management**: Improve the settings pattern in `src/config.py`

### Medium Priority Improvements:
1. **Service Layer**: Consider implementing a proper service layer pattern
2. **Background Tasks**: Review background task implementation
3. **WebSocket Implementation**: Optimize real-time data updates
4. **Static File Organization**: Improve frontend asset organization
5. **Script Consolidation**: Consolidate similar utility scripts

### Code Patterns to Maintain:
- Keep the FastAPI + FastF1 integration working seamlessly
- Preserve all existing API endpoints and their functionality
- Maintain compatibility with the current frontend implementation
- Keep the Docker containerization working properly
- Preserve the current caching strategy while improving it

## Key Requirements
- **Zero Breaking Changes**: Maintain all existing functionality and API contracts
- **Preserve Performance**: No degradation of current performance
- **Keep Dependencies Minimal**: Avoid unnecessary new dependencies
- **Maintain Docker Deployment**: Keep containerization working

## Tech Stack
- **Backend**: FastAPI, Python 3.8+, FastF1, Redis, Supabase
- **Frontend**: Vanilla JavaScript, HTML5, CSS3  
- **Data Processing**: Pandas, NumPy
- **Deployment**: Docker, Docker Compose
- **Dev Tools**: Black, isort, flake8, pytest

Focus on making the codebase more professional, maintainable, and scalable while preserving all existing functionality. Provide specific, actionable recommendations with code examples.
