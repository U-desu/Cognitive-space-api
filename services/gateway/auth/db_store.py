"""PostgreSQL store for Gateway auth.

Implements the same interface as memory_store.py.
"""

from typing import Optional

from services.shared.db_config import get_db_session
from services.shared.models import User
from services.gateway.auth.models_db import UserDB, PasswordDB, OAuthAccountDB, UserSpaceDB


def _user_from_db(row: UserDB) -> User:
    return User(
        user_id=row.user_id,
        username=row.username,
        email=row.email,
        avatar=row.avatar,
        auth_provider=row.auth_provider or "password",
        created_at=int(row.created_at.timestamp()) if row.created_at else 0,
    )


def create_user(user: User) -> None:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        row = session.query(UserDB).filter_by(user_id=user.user_id).first()
        data = {
            "username": user.username,
            "email": user.email,
            "avatar": user.avatar,
            "auth_provider": user.auth_provider,
        }
        if row:
            for k, v in data.items():
                setattr(row, k, v)
        else:
            session.add(UserDB(user_id=user.user_id, **data))
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def get_user(user_id: str) -> Optional[User]:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        row = session.query(UserDB).filter_by(user_id=user_id).first()
        return _user_from_db(row) if row else None
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def get_user_by_username(username: str) -> Optional[User]:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        row = session.query(UserDB).filter_by(username=username).first()
        return _user_from_db(row) if row else None
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def get_user_by_oauth(provider: str, provider_id: str) -> Optional[User]:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        oauth = session.query(OAuthAccountDB).filter_by(
            provider=provider, provider_account_id=provider_id
        ).first()
        if not oauth:
            return None
        row = session.query(UserDB).filter_by(user_id=oauth.user_id).first()
        return _user_from_db(row) if row else None
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def save_password(user_id: str, password_hash: str) -> None:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        row = session.query(PasswordDB).filter_by(user_id=user_id).first()
        if row:
            row.password_hash = password_hash
        else:
            session.add(PasswordDB(user_id=user_id, password_hash=password_hash))
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def get_password_hash(user_id: str) -> Optional[str]:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        row = session.query(PasswordDB).filter_by(user_id=user_id).first()
        return row.password_hash if row else None
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def link_oauth(user_id: str, provider: str, provider_id: str) -> None:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        existing = session.query(OAuthAccountDB).filter_by(
            provider=provider, provider_account_id=provider_id
        ).first()
        if existing:
            existing.user_id = user_id
        else:
            session.add(OAuthAccountDB(
                user_id=user_id, provider=provider, provider_account_id=provider_id
            ))
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def link_space_to_user(user_id: str, space_id: str) -> None:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        existing = session.query(UserSpaceDB).filter_by(user_id=user_id, space_id=space_id).first()
        if not existing:
            session.add(UserSpaceDB(user_id=user_id, space_id=space_id))
            session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def get_user_spaces(user_id: str) -> list[str]:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        rows = session.query(UserSpaceDB).filter_by(user_id=user_id).all()
        return [r.space_id for r in rows]
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass
