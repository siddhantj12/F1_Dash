from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .routers import telemetry, races, positions, tires, auth, drivers
import fastf1

app = FastAPI(title="F1 Telemetry API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Enable FastF1 cache
fastf1.Cache.enable_cache('fastf1_cache')

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
    from fastapi.responses import FileResponse
    return FileResponse("static/index.html")