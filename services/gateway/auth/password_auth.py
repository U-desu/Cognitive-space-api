import uuid
import time
from typing import Optional

from passlib.context import CryptContext

from services.shared.models import User, UserRegisterRequest, UserLoginRequest
from services.gateway.auth.store import create_user, get_user_by_username, save_password, get_password_hash

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
PEPPER = ""  # 可在生产环境通过环境变量注入


def hash_password(password: str) -> str:
    return pwd_context.hash(password + PEPPER)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password + PEPPER, hashed)


def register_user(req: UserRegisterRequest) -> User:
    if len(req.password) < 6:
        raise ValueError("Password must be at least 6 characters")

    if get_user_by_username(req.username):
        raise ValueError("Username already taken")

    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    user = User(
        user_id=user_id,
        username=req.username,
        email=req.email,
        auth_provider="password",
        created_at=int(time.time()),
    )
    create_user(user)
    save_password(user_id, hash_password(req.password))
    return user


def authenticate_user(req: UserLoginRequest) -> Optional[User]:
    user = get_user_by_username(req.username)
    if not user:
        return None
    pw_hash = get_password_hash(user.user_id)
    if not pw_hash or not verify_password(req.password, pw_hash):
        return None
    return user
