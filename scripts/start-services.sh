#!/bin/bash
# Start all Cognitive Space microservices.
# Usage: ./scripts/start-services.sh
# Each service runs in the background and logs to /tmp/cognitive-space-*.log

cd "$(dirname "$0")/.."

echo "Starting Cognitive Space microservices..."

# Initialize database if USE_DB is enabled
if [ "$USE_DB" = "true" ]; then
    echo "Initializing PostgreSQL database..."
    python3 scripts/init_db.py
    if [ $? -ne 0 ]; then
        echo "WARNING: Database initialization failed. Services may not work correctly."
    fi
fi

# Kill any existing services
pkill -f 'uvicorn services' 2>/dev/null

sleep 1

# Start services
python3 -m uvicorn services.core.main:app --host 0.0.0.0 --port 8001 --log-level info > /tmp/cognitive-space-core.log 2>&1 &
echo "Core Service started on port 8001 (pid $!)"

python3 -m uvicorn services.generator.main:app --host 0.0.0.0 --port 8002 --log-level info > /tmp/cognitive-space-generator.log 2>&1 &
echo "Generator Service started on port 8002 (pid $!)"

python3 -m uvicorn services.compute.main:app --host 0.0.0.0 --port 8003 --log-level info > /tmp/cognitive-space-compute.log 2>&1 &
echo "Compute Service started on port 8003 (pid $!)"

python3 -m uvicorn services.aggregator.main:app --host 0.0.0.0 --port 8004 --log-level info > /tmp/cognitive-space-aggregator.log 2>&1 &
echo "Aggregator Service started on port 8004 (pid $!)"

# Wait for downstream services to be ready
sleep 2

python3 -m uvicorn services.gateway.main:app --host 0.0.0.0 --port 8000 --log-level info > /tmp/cognitive-space-gateway.log 2>&1 &
echo "Gateway started on port 8000 (pid $!)"

echo ""
echo "All services started!"
echo "Gateway:     http://localhost:8000"
echo "Core:        http://localhost:8001"
echo "Generator:   http://localhost:8002"
echo "Compute:     http://localhost:8003"
echo "Aggregator:  http://localhost:8004"
echo ""
echo "Frontend:    http://localhost:5173"
echo ""
echo "Logs: /tmp/cognitive-space-*.log"
echo "Stop: pkill -f 'uvicorn services'"
