from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import sys
import os

# Add the project root to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.api.routes import router as api_router

# Create FastAPI app
app = FastAPI(title="F1 Dash API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")

# Serve static files
app.mount("/", StaticFiles(directory="static", html=True), name="static")

# Root endpoint to serve the frontend
@app.get("/", include_in_schema=False)
async def serve_frontend():
    return FileResponse("static/index.html") 