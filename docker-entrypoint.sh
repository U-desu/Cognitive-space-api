#!/bin/bash
set -m

cleanup() {
    echo "[entrypoint] Shutting down services..."
    pkill -f 'uvicorn services' 2>/dev/null || true
    exit 0
}
trap cleanup SIGTERM SIGINT

cd /app

# Clean up any existing uvicorn processes
pkill -f 'uvicorn services' 2>/dev/null || true
sleep 1

echo "[entrypoint] Starting downstream services..."

python3 -m uvicorn services.core.main:app \
    --host 0.0.0.0 --port 8001 --log-level info \
    > /var/log/core.log 2>&1 &

python3 -m uvicorn services.generator.main:app \
    --host 0.0.0.0 --port 8002 --log-level info \
    > /var/log/generator.log 2>&1 &

python3 -m uvicorn services.compute.main:app \
    --host 0.0.0.0 --port 8003 --log-level info \
    > /var/log/compute.log 2>&1 &

python3 -m uvicorn services.aggregator.main:app \
    --host 0.0.0.0 --port 8004 --log-level info \
    > /var/log/aggregator.log 2>&1 &

# Wait for downstream services to be ready
sleep 2

echo "[entrypoint] Starting Gateway..."
python3 -m uvicorn services.gateway.main:app \
    --host 0.0.0.0 --port 8000 --log-level info \
    > /var/log/gateway.log 2>&1 &

echo "[entrypoint] All backend services started."
echo "[entrypoint] Gateway: http://0.0.0.0:8000"
echo "[entrypoint] Logs: /var/log/{gateway,core,generator,compute,aggregator}.log"

# Keep container alive and forward signals to child processes
while true; do
    sleep 3600 &
    wait $!
done
