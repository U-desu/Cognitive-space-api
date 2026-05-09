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

# ── Service ports (override via env vars) ──
CORE_PORT="${CORE_PORT:-8001}"
GENERATOR_PORT="${GENERATOR_PORT:-8002}"
COMPUTE_PORT="${COMPUTE_PORT:-8003}"
AGGREGATOR_PORT="${AGGREGATOR_PORT:-8004}"
GATEWAY_PORT="${GATEWAY_PORT:-8000}"

# Start services
python3 -m uvicorn services.core.main:app --host 0.0.0.0 --port "$CORE_PORT" --log-level info > /tmp/cognitive-space-core.log 2>&1 &
echo "Core Service started on port $CORE_PORT (pid $!)"

python3 -m uvicorn services.generator.main:app --host 0.0.0.0 --port "$GENERATOR_PORT" --log-level info > /tmp/cognitive-space-generator.log 2>&1 &
echo "Generator Service started on port $GENERATOR_PORT (pid $!)"

python3 -m uvicorn services.compute.main:app --host 0.0.0.0 --port "$COMPUTE_PORT" --log-level info > /tmp/cognitive-space-compute.log 2>&1 &
echo "Compute Service started on port $COMPUTE_PORT (pid $!)"

python3 -m uvicorn services.aggregator.main:app --host 0.0.0.0 --port "$AGGREGATOR_PORT" --log-level info > /tmp/cognitive-space-aggregator.log 2>&1 &
echo "Aggregator Service started on port $AGGREGATOR_PORT (pid $!)"

# Wait for downstream services to be ready
sleep 2

python3 -m uvicorn services.gateway.main:app --host 0.0.0.0 --port "$GATEWAY_PORT" --log-level info > /tmp/cognitive-space-gateway.log 2>&1 &
echo "Gateway started on port $GATEWAY_PORT (pid $!)"

echo ""
echo "All services started!"
echo "Gateway:     http://localhost:$GATEWAY_PORT"
echo "Core:        http://localhost:$CORE_PORT"
echo "Generator:   http://localhost:$GENERATOR_PORT"
echo "Compute:     http://localhost:$COMPUTE_PORT"
echo "Aggregator:  http://localhost:$AGGREGATOR_PORT"
echo ""
echo "Frontend:    http://localhost:5173"
echo ""
echo "Logs: /tmp/cognitive-space-*.log"
echo "Stop: pkill -f 'uvicorn services'"
