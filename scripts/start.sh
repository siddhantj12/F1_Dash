#!/bin/bash

echo "======================= F1 Dash Startup ======================="
echo "Starting with critical bug fixes for comparison and visualization"
echo "=============================================================="
echo ""

# Stop any running containers
echo "Stopping any existing containers..."
docker-compose down

# Rebuild and start in detached mode
echo "Building and starting new containers with fixes..."
docker-compose up --build -d

echo ""
echo "F1 Dash application started!"
echo "Visit http://localhost:8000 in your browser"
echo ""
echo "Issues fixed:"
echo "✅ Fixed backend comparison API to work correctly"
echo "✅ Fixed team colors for all drivers"
echo "✅ Fixed track visualization to properly load tracks"
echo "✅ Fixed driver comparison functionality"
echo "✅ Improved error handling and debugging"
echo ""
echo "To view logs:        docker-compose logs -f"
echo "To stop containers:  docker-compose down"
echo "To restart:          ./start.sh"
echo ""
echo "==============================================================" 