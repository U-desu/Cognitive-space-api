import uuid
import time
from typing import Optional, Dict, Any

import httpx

from services.shared.models import User
from services.shared.config import GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_REDIRECT_URI
from services.gateway.auth.store import (
    get_user_by_oauth,
    create_user,
    link_oauth,
)


def get_github_authorize_url(state: str = "default") -> str:
    """生成 GitHub OAuth 授权 URL."""
    return (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&redirect_uri={GITHUB_REDIRECT_URI}"
        f"&scope=read:user user:email"
        f"&state={state}"
    )


async def exchange_code_for_token(code: str) -> Optional[str]:
    """用 code 换 access_token."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_REDIRECT_URI,
            },
        )
        data = resp.json()
        return data.get("access_token")


async def get_github_user(access_token: str) -> Optional[Dict[str, Any]]:
    """获取 GitHub 用户信息."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"token {access_token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        if resp.status_code != 200:
            return None
        return resp.json()


async def handle_github_callback(code: str) -> Optional[User]:
    """处理 GitHub OAuth 回调，返回 User（新用户或已存在用户）."""
    access_token = await exchange_code_for_token(code)
    if not access_token:
        return None

    gh_user = await get_github_user(access_token)
    if not gh_user:
        return None

    provider_id = str(gh_user.get("id"))
    existing = get_user_by_oauth("github", provider_id)
    if existing:
        return existing

    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    user = User(
        user_id=user_id,
        username=gh_user.get("login") or f"github_{provider_id}",
        email=gh_user.get("email"),
        avatar=gh_user.get("avatar_url"),
        auth_provider="github",
        created_at=int(time.time()),
    )
    create_user(user)
    link_oauth(user_id, "github", provider_id)
    return user
