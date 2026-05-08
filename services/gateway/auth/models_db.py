"""SQLAlchemy ORM models for Gateway auth (PostgreSQL).

Schema: auth
Tables: users, passwords, oauth_accounts, user_spaces
"""

from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func

from services.shared.db_config import Base, DB_SCHEMA_AUTH

SCHEMA = DB_SCHEMA_AUTH


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
