# ── Backend: All Python microservices in one container ──
FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/ && \
    pip config set global.trusted-host mirrors.aliyun.com && \
    pip install --no-cache-dir --timeout 120 --retries 5 -r requirements.txt

# Copy application code
COPY . .

# Copy entrypoint
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose all service ports
EXPOSE 8000 8001 8002 8003 8004

ENTRYPOINT ["docker-entrypoint.sh"]
