# F1 Dash - Formula 1 Telemetry Dashboard

A web application for visualizing and comparing Formula 1 telemetry data.

## Project Structure

```
F1-Dash/
├── src/
│   ├── api/              # API endpoints and FastAPI application
│   ├── utils/            # Utility functions and helpers
│   ├── models/           # Data models and schemas
│   ├── services/         # Business logic and services
│   └── tests/            # Test files
├── static/              # Static files (CSS, JS, images)
├── docs/                # Documentation
├── scripts/             # Utility scripts
├── fastf1_cache/        # FastF1 data cache
├── requirements.txt     # Python dependencies
├── Dockerfile          # Docker configuration
├── docker-compose.yml  # Docker Compose configuration
└── README.md           # This file
```

## Features

- Display F1 telemetry data from 2018-2025 seasons
- View speed, throttle/brake, and gear data for any driver
- Compare two drivers' telemetry data side by side
- Track visualization with sector coloring based on performance
- Team color coding for better visualization

## Getting Started

### Using Docker (Recommended)

1. Make sure you have Docker and Docker Compose installed
2. Make the start script executable:
   ```
   chmod +x scripts/start.sh
   ```
3. Run the start script:
   ```
   ./scripts/start.sh
   ```
4. Open your browser and go to: http://localhost:8000

### Manual Setup

1. Install Python 3.8 or later
2. Create and activate a virtual environment:
   ```
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
3. Install required packages:
   ```
   pip install -r requirements.txt
   ```
4. Run the application:
   ```
   python -m src.api.main
   ```
5. Open your browser and go to: http://localhost:8000

## Using the Application

1. Select a season, race, and session
2. Choose a driver and lap to view telemetry
3. Optionally select a comparison driver and lap
4. Click "Load Telemetry" to display the data

## Development

- The project uses FastAPI for the backend API
- Frontend is built with modern web technologies
- FastF1 package is used for F1 data retrieval
- Docker is used for containerization

## Troubleshooting

- If you encounter issues with Docker, try stopping all containers with:
  ```
  docker-compose down
  ```
  And then restart with:
  ```
  docker-compose up --build
  ```

- If you see data loading errors, try clearing your browser cache

- For debugging, click on the status text at the top right to show debug information

## License

This project is for educational purposes only. Formula 1 data is provided by the FastF1 package.
