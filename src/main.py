import os
import fastf1
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from src.routers import auth, drivers, news, positions, races, telemetry, tires, profile, standings
from src.config import settings
from src.utils.logger import logger
from src.etl.data_extractor import TelemetryExtractor

app = FastAPI(title="F1 Dash", docs_url=None, redoc_url=None)  # Disable docs in production

extractor = TelemetryExtractor()

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Read allowed origins from env; fall back to localhost for local dev only
_raw_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:8002,http://127.0.0.1:8002,https://thef1core.com,https://www.thef1core.com"
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Security headers ──────────────────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://*.supabase.co https://*.auth0.com; "
        "frame-ancestors 'none';"
    )
    return response

# ── Request logger ────────────────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url.path}")
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
app.include_router(news.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(standings.router, prefix="/api")

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