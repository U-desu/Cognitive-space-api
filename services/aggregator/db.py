"""Aggregator Service database configuration (reserved).

Current: all data is served from mock_data.py (memory).
Future: when USE_AGGREGATOR_DB=true, switch to PostgreSQL JSONB or MongoDB.

Schema: aggregator (reserved in PostgreSQL)
Collections: external_users, external_questions, presets
"""

from services.shared.db_config import USE_DB, engine, Base, DB_SCHEMA_AGGREGATOR

USE_AGGREGATOR_DB = USE_DB  # Align with global DB toggle
SCHEMA = DB_SCHEMA_AGGREGATOR


# Reserved SQLAlchemy models for future migration
# from sqlalchemy import Column, String, Text, Integer, DateTime, JSON
# from sqlalchemy.dialects.postgresql import JSONB
# from sqlalchemy.sql import func
#
# class ExternalUserDB(Base):
#     __tablename__ = "external_users"
#     __table_args__ = {"schema": SCHEMA}
#     id = Column(Integer, primary_key=True, autoincrement=True)
#     platform = Column(String(20))
#     name = Column(String(200))
#     avatar = Column(Text)
#     title = Column(Text)
#     followers = Column(String(50))
#     url = Column(Text)
#     domain = Column(String(50))
#     data = Column(JSONB, default=dict)
#     created_at = Column(DateTime(timezone=True), server_default=func.now())
#
# class ExternalQuestionDB(Base):
#     __tablename__ = "external_questions"
#     __table_args__ = {"schema": SCHEMA}
#     id = Column(Integer, primary_key=True, autoincrement=True)
#     platform = Column(String(20))
#     title = Column(Text)
#     url = Column(Text)
#     views = Column(String(50))
#     domain = Column(String(50))
#     data = Column(JSONB, default=dict)
#     created_at = Column(DateTime(timezone=True), server_default=func.now())
#
# class PresetDB(Base):
#     __tablename__ = "presets"
#     __table_args__ = {"schema": SCHEMA}
#     id = Column(Integer, primary_key=True, autoincrement=True)
#     type = Column(String(50))
#     icon_type = Column(String(50))
#     label = Column(String(100))
#     text = Column(Text)
#     color = Column(String(20))
#     order = Column(Integer)
