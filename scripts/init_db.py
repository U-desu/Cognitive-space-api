#!/usr/bin/env python3
"""Initialize PostgreSQL database schemas and tables.

Usage:
    python3 scripts/init_db.py

Requires:
    - PostgreSQL running
    - DATABASE_URL env var set (or default localhost)
    - USE_DB=true
"""

import sys
sys.path.insert(0, ".")

from services.shared.db_config import USE_DB, engine, Base
from services.core.models_db import (
    SpaceDB, AgentDB, EdgeDB, DebateDB, TrajectoryDB, TrajectoryEventDB,
    UserDB, PasswordDB, OAuthAccountDB, UserSpaceDB,
)
from services.gateway.auth.models_db import (
    UserDB as AuthUserDB,
    PasswordDB as AuthPasswordDB,
    OAuthAccountDB as AuthOAuthAccountDB,
    UserSpaceDB as AuthUserSpaceDB,
)
# Aggregator models reserved for future use
# from services.aggregator.db import ExternalUserDB, ExternalQuestionDB, PresetDB


def init_database():
    if not USE_DB:
        print("WARNING: USE_DB is not set to true. Set USE_DB=true to enable PostgreSQL.")
        print("Running in memory mode — no database initialization needed.")
        return

    if engine is None:
        print("ERROR: Database engine not initialized. Check DATABASE_URL.")
        sys.exit(1)

    from sqlalchemy import text

    # Create schemas
    schemas = ["core", "auth", "aggregator"]
    with engine.connect() as conn:
        for schema in schemas:
            conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema}"))
        # Enable pgvector extension in core schema
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()

    # Create all tables
    Base.metadata.create_all(bind=engine)

    print("Database initialized successfully.")
    print("Schemas: core, auth, aggregator")
    print("Tables created in core: spaces, agents, edges, debates, trajectories, trajectory_events")
    print("Tables created in auth: users, passwords, oauth_accounts, user_spaces")


if __name__ == "__main__":
    init_database()
