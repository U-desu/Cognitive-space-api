import uuid
import time
from typing import Optional, Dict, Any

import httpx

from services.shared.models import User
from services.shared.config import (
    ZHIHU_APP_ID,
    ZHIHU_APP_KEY,
    ZHIHU_REDIRECT_URI,
    ZHIHU_AUTHORIZE_URL,
    ZHIHU_TOKEN_URL,
    ZHIHU_USERINFO_URL,
)
from services.gateway.auth.store import (
    get_user_by_oauth,
    create_user,
    link_oauth,
)


def get_zhihu_authorize_url(state: str = "default") -> str:
    """生成知乎 OAuth 授权 URL."""
    return (
        f"{ZHIHU_AUTHORIZE_URL}"
        f"?redirect_uri={ZHIHU_REDIRECT_URI}"
        f"&app_id={ZHIHU_APP_ID}"
        f"&response_type=code"
        f"&state={state}"
    )


async def exchange_code_for_token(code: str) -> Optional[str]:
    """用 code 换取知乎 access_token."""
    async with httpx.AsyncClient(trust_env=False) as client:
        resp = await client.post(
            ZHIHU_TOKEN_URL,
            headers={"Accept": "application/json"},
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": ZHIHU_REDIRECT_URI,
                "client_id": ZHIHU_APP_ID,
                "client_secret": ZHIHU_APP_KEY,
            },
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        # 知乎可能直接返回 access_token 或在 data 字段中
        return data.get("access_token") or data.get("data", {}).get("access_token")


async def get_zhihu_user(access_token: str) -> Optional[Dict[str, Any]]:
    """获取知乎用户信息."""
    async with httpx.AsyncClient(trust_env=False) as client:
        resp = await client.get(
            ZHIHU_USERINFO_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
        )
        if resp.status_code != 200:
            return None
        return resp.json()


async def handle_zhihu_callback(code: str) -> Optional[User]:
    """处理知乎 OAuth 回调，返回 User（新用户或已存在用户）."""
    access_token = await exchange_code_for_token(code)
    if not access_token:
        return None

    zhihu_user = await get_zhihu_user(access_token)
    if not zhihu_user:
        return None

    # 知乎用户唯一标识：使用 url 或 name 作为 provider_id（如果接口未返回独立 id）
    provider_id = str(zhihu_user.get("id") or zhihu_user.get("url") or zhihu_user.get("name"))
    existing = get_user_by_oauth("zhihu", provider_id)
    if existing:
        return existing

    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    user = User(
        user_id=user_id,
        username=zhihu_user.get("name") or f"zhihu_{provider_id}",
        email=zhihu_user.get("email") or None,
        avatar=zhihu_user.get("avatar_path") or None,
        auth_provider="zhihu",
        created_at=int(time.time()),
    )
    create_user(user)
    link_oauth(user_id, "zhihu", provider_id)
    return user
