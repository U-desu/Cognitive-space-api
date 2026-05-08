from fastapi import Request, HTTPException, status
from typing import Optional

from services.gateway.auth.jwt import decode_token, COOKIE_NAME


async def get_current_user(request: Request) -> Optional[dict]:
    """从 httpOnly Cookie 中提取当前用户，未登录返回 None（访客兼容）."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    user_id = decode_token(token)
    if not user_id:
        return None
    return {"user_id": user_id}


async def require_user(request: Request) -> dict:
    """强制要求登录，未登录抛 401."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return user
