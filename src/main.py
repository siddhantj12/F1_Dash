import fastf1
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.routers import auth, drivers, positions, races, telemetry, tires
from src.config import settings
from src.utils.logger import logger
from src.etl.data_extractor import TelemetryExtractor

app = FastAPI(title="F1 Dash")

extractor = TelemetryExtractor()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    response = await call_next(request)
    return response


# Enable FastF1 cache
fastf1.Cache.enable_cache(settings.fastf1_cache_dir)

# Include routers
app.include_router(telemetry.router, prefix="/api")
app.include_router(races.router, prefix="/api")
app.include_router(positions.router, prefix="/api")
app.include_router(tires.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(drivers.router, prefix="/api")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")


# Add a route to serve the frontend
@app.get("/", include_in_schema=False)
async def serve_frontend():
    logger.info("Serving frontend from root URL")
    from fastapi.responses import FileResponse
    from pathlib import Path

    return FileResponse(Path(__file__).parent.parent / "static" / "index.html")


@app.get("/api/seasons")
async def get_seasons():
    return list(range(2018, extractor.year + 1))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8002)