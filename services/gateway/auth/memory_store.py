"""In-memory user store for Gateway auth.

Default backend when USE_DB=false.
"""

from typing import Dict, Optional
from services.shared.models import User

_users: Dict[str, User] = {}
_passwords: Dict[str, str] = {}
_oauth_accounts: Dict[str, str] = {}
_user_spaces: Dict[str, list[str]] = {}


def create_user(user: User) -> None:
    _users[user.user_id] = user


def get_user(user_id: str) -> Optional[User]:
    return _users.get(user_id)


def get_user_by_username(username: str) -> Optional[User]:
    for u in _users.values():
        if u.username == username:
            return u
    return None


def get_user_by_oauth(provider: str, provider_id: str) -> Optional[User]:
    user_id = _oauth_accounts.get(f"{provider}:{provider_id}")
    return _users.get(user_id) if user_id else None


def save_password(user_id: str, password_hash: str) -> None:
    _passwords[user_id] = password_hash


def get_password_hash(user_id: str) -> Optional[str]:
    return _passwords.get(user_id)


def link_oauth(user_id: str, provider: str, provider_id: str) -> None:
    _oauth_accounts[f"{provider}:{provider_id}"] = user_id


def link_space_to_user(user_id: str, space_id: str) -> None:
    if user_id not in _user_spaces:
        _user_spaces[user_id] = []
    if space_id not in _user_spaces[user_id]:
        _user_spaces[user_id].append(space_id)


def get_user_spaces(user_id: str) -> list[str]:
    return _user_spaces.get(user_id, [])
