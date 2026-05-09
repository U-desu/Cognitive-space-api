"""SQLAlchemy ORM models for Core Service (PostgreSQL).

Schema: core
Tables: spaces, agents, edges, debates, trajectories, trajectory_events
"""

from sqlalchemy import (
    Column, String, Text, Float, Boolean, Integer,
    DateTime, ForeignKey, ForeignKeyConstraint, ARRAY,
)
from sqlalchemy.dialects.postgresql import JSONB, ARRAY as PG_ARRAY
from sqlalchemy.sql import func

from services.shared.db_config import Base, DB_SCHEMA_CORE

SCHEMA = DB_SCHEMA_CORE


class SpaceDB(Base):
    __tablename__ = "spaces"
    __table_args__ = {"schema": SCHEMA}

    space_id = Column(String(20), primary_key=True)
    query = Column(Text, nullable=False)
    dimensions = Column(JSONB, nullable=False, default=dict)
    metadata_ = Column("metadata", JSONB, nullable=False, default=dict)
    user_id = Column(String(30), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AgentDB(Base):
    __tablename__ = "agents"
    __table_args__ = {"schema": SCHEMA}

    agent_id = Column(String(20), primary_key=True)
    space_id = Column(String(20), ForeignKey(f"{SCHEMA}.spaces.space_id", ondelete="CASCADE"), primary_key=True)
    name = Column(String(100), nullable=False)
    persona = Column(Text)
    domain = Column(String(50))
    summary = Column(Text)
    stance = Column(String(20))
    confidence = Column(Float)
    authority = Column(Float)
    novelty = Column(Float)
    embedding = Column(PG_ARRAY(Float))
    parent_id = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EdgeDB(Base):
    __tablename__ = "edges"
    __table_args__ = (
        ForeignKeyConstraint(
            ["space_id", "source_agent_id"],
            [f"{SCHEMA}.agents.space_id", f"{SCHEMA}.agents.agent_id"],
        ),
        ForeignKeyConstraint(
            ["space_id", "target_agent_id"],
            [f"{SCHEMA}.agents.space_id", f"{SCHEMA}.agents.agent_id"],
        ),
        {"schema": SCHEMA},
    )

    edge_id = Column(String(50), primary_key=True)
    space_id = Column(String(20), ForeignKey(f"{SCHEMA}.spaces.space_id", ondelete="CASCADE"), primary_key=True)
    source_agent_id = Column(String(20), nullable=False)
    target_agent_id = Column(String(20), nullable=False)
    conflict_score = Column(Float, nullable=False)
    conflict_type = Column(String(20))
    shared_ground = Column(PG_ARRAY(Text))
    divergence_axes = Column(JSONB)
    debate_recommended = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DebateDB(Base):
    __tablename__ = "debates"
    __table_args__ = {"schema": SCHEMA}

    debate_id = Column(String(20), primary_key=True)
    space_id = Column(String(20), ForeignKey(f"{SCHEMA}.spaces.space_id", ondelete="CASCADE"), nullable=False)
    edge_id = Column(String(50), nullable=False)
    participants = Column(PG_ARRAY(Text), nullable=False)
    transcript = Column(JSONB, nullable=False)
    synthesis = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TrajectoryDB(Base):
    __tablename__ = "trajectories"
    __table_args__ = {"schema": SCHEMA}

    trajectory_id = Column(String(20), primary_key=True)
    space_id = Column(String(20), ForeignKey(f"{SCHEMA}.spaces.space_id", ondelete="CASCADE"), nullable=False, unique=True)
    path = Column(JSONB, nullable=False, default=list)
    cognitive_metrics = Column(JSONB, nullable=False, default=dict)
    journey_stage = Column(String(50), default="exploration")
    suggested_next = Column(JSONB)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TrajectoryEventDB(Base):
    __tablename__ = "trajectory_events"
    __table_args__ = {"schema": SCHEMA}

    event_id = Column(Integer, primary_key=True, autoincrement=True)
    trajectory_id = Column(String(20), ForeignKey(f"{SCHEMA}.trajectories.trajectory_id", ondelete="CASCADE"), nullable=False)
    node = Column(String(50), nullable=False)
    action = Column(String(50), nullable=False)
    dwell_time = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ── User / Auth (mirrors memory_store for backward compat) ──

class UserDB(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": SCHEMA}

    user_id = Column(String(30), primary_key=True)
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(200))
    avatar = Column(Text)
    auth_provider = Column(String(20), default="password")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PasswordDB(Base):
    __tablename__ = "passwords"
    __table_args__ = {"schema": SCHEMA}

    user_id = Column(String(30), ForeignKey(f"{SCHEMA}.users.user_id", ondelete="CASCADE"), primary_key=True)
    password_hash = Column(Text, nullable=False)


class OAuthAccountDB(Base):
    __tablename__ = "oauth_accounts"
    __table_args__ = {"schema": SCHEMA}

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(30), ForeignKey(f"{SCHEMA}.users.user_id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(20), nullable=False)
    provider_account_id = Column(String(100), nullable=False, unique=True)


class UserSpaceDB(Base):
    __tablename__ = "user_spaces"
    __table_args__ = {"schema": SCHEMA}

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(30), ForeignKey(f"{SCHEMA}.users.user_id", ondelete="CASCADE"), nullable=False)
    space_id = Column(String(20), nullable=False)
