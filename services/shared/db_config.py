"""Unified database configuration.

Design:
- Single PostgreSQL instance with schema isolation (core / auth / aggregator)
- Memory mode fallback (USE_DB=false) for zero-dependency demo
- Redis config reserved for future Generator caching
- Future split: change connection string per service
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv = __import__("dotenv").load_dotenv
load_dotenv()

# ── PostgreSQL ──
_raw_url = os.getenv("DATABASE_URL", "postgresql://localhost:5432/cognitive_space")
# Use psycopg3 driver (installed as psycopg package)
if _raw_url.startswith("postgresql://") and not _raw_url.startswith("postgresql+"):
    DATABASE_URL = _raw_url.replace("postgresql://", "postgresql+psycopg://", 1)
elif _raw_url.startswith("postgres://") and not _raw_url.startswith("postgres+"):
    DATABASE_URL = _raw_url.replace("postgres://", "postgresql+psycopg://", 1)
else:
    DATABASE_URL = _raw_url
DB_SCHEMA_CORE = os.getenv("DB_SCHEMA_CORE", "core")
DB_SCHEMA_AUTH = os.getenv("DB_SCHEMA_AUTH", "auth")
DB_SCHEMA_AGGREGATOR = os.getenv("DB_SCHEMA_AGGREGATOR", "aggregator")
USE_DB = os.getenv("USE_DB", "false").lower() == "true"

# Small pool for single-machine demo (5 connections max)
engine = None
SessionLocal = None
Base = declarative_base()

if USE_DB:
    engine = create_engine(
        DATABASE_URL,
        pool_size=3,
        max_overflow=0,
        pool_pre_ping=True,
        echo=False,
    )
    SessionLocal = sessionmaker(bind=engine)


def get_db_session():
    """Yield a DB session. Must be used as context manager."""
    if not SessionLocal:
        raise RuntimeError("Database not enabled. Set USE_DB=true")
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


# ── Redis (reserved) ──
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
USE_REDIS = os.getenv("USE_REDIS", "false").lower() == "true"

_redis_client = None

if USE_REDIS:
    try:
        import redis as _redis_lib
        _redis_client = _redis_lib.from_url(REDIS_URL, decode_responses=True)
    except Exception:
        _redis_client = None


def get_redis_client():
    return _redis_client
