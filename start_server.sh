#!/bin/bash
cd "$(dirname "$0")"
export PYTHONPATH="/Users/siddhant/Desktop/F1/.venv312/lib/python3.12/site-packages:$(pwd)"
exec /opt/homebrew/Cellar/python@3.12/3.12.13/Frameworks/Python.framework/Versions/3.12/bin/python3.12 \
  -m uvicorn src.main:app --host 0.0.0.0 --port 8002 --reload
