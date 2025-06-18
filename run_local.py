#!/usr/bin/env python3
"""
Run F1 Dash locally without Docker
"""
import uvicorn

if __name__ == "__main__":
    # Run the FastAPI application with uvicorn
    # host="127.0.0.1" ensures it only binds to localhost
    # port=8000 is the standard port for the application
    # reload=True enables auto-reloading on code changes
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
    
    print("F1 Dash is running at http://127.0.0.1:8000") 