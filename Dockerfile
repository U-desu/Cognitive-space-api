# ── Backend: All Python microservices in one container ──
FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Copy entrypoint
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose all service ports
EXPOSE 8000 8001 8002 8003 8004

ENTRYPOINT ["docker-entrypoint.sh"]
