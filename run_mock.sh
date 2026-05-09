#!/bin/bash
# Start all microservices in mock LLM mode (no API key needed).
# Usage: ./run_mock.sh
export MOCK_LLM=true
export LLM_PROVIDER=openai
export COMPUTE_EMBED_BACKEND=mock
exec ./scripts/start-services.sh
