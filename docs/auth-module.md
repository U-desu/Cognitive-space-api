# Gateway Auth Module 架构设计文档

> 本文档描述 Gateway Service 中认证模块的架构、安全机制、模块划分和关键设计决策。
>
> 对应架构版本：微服务 v0.2.0  
> 文档版本：v1.0

---

## 服务定位

Auth Module 内嵌于 Gateway Service（port 8000），是系统的**统一认证入口**。负责：

| 能力 | 说明 |
|------|------|
| **密码认证** | 用户名/密码注册、登录、bcrypt 哈希 |
| **GitHub OAuth** | 标准 OAuth2 授权码流程，一键登录 |
| **JWT 会话管理** | httpOnly Cookie 存储，自动续期 |
| **访客模式兼容** | 未登录用户可正常使用核心功能 |
| **用户空间关联** | 登录用户创建的 Space 自动关联到用户 |

**设计原则**：
- **Gateway 内嵌认证，不新增服务**：减少微服务数量，降低网络跳转
- **双后端透明切换**：`USE_DB=false`（内存）/ `true`（PostgreSQL `auth` schema）
- **访客优先**：所有核心功能无需登录，仅"我的空间"等个性化功能需要认证
- **Cookie 而非 Header**：前端通过 `credentials: 'include'` 自动携带，无 Token 管理负担

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│              Gateway Service (port 8000)                     │
│                                                              │
│  ┌─────────────┐   ┌─────────────────────────────────────┐  │
│  │  Auth Routes│   │           Auth Module                │  │
│  │  (main.py)  │◄──│                                      │  │
│  │             │   │  ┌─────────┐  ┌─────────┐          │  │
│  │ /auth/*     │   │  │  JWT    │  │ Password│          │  │
│  │ /spaces/my  │   │  │ Layer   │  │  Auth   │          │  │
│  └─────────────┘   │  └────┬────┘  └────┬────┘          │  │
│                    │       │            │               │  │
│                    │  ┌────┴────────────┴────┐          │  │
│                    │  │   Dependencies        │          │  │
│                    │  │  get_current_user     │          │  │
│                    │  │  require_user         │          │  │
│                    │  └──────────┬────────────┘          │  │
│                    │             │                       │  │
│                    │  ┌──────────┴──────────┐            │  │
│                    │  │    Store Dispatcher  │            │  │
│                    │  │  USE_DB switch       │            │  │
│                    │  └──────┬──────┬───────┘            │  │
│                    │         │      │                    │  │
│                    │  ┌──────┘      └──────┐             │  │
│                    │  │ memory_store.py    │             │  │
│                    │  │ db_store.py (PG)   │             │  │
│                    │  └────────────────────┘             │  │
│                    └─────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

---

## 模块详解

### 1. JWT Layer (`jwt.py`)

**职责**：JWT 签发、解码、Cookie 名称常量。

```python
# 配置来源：services/shared/config.py
JWT_SECRET_KEY      # 签名密钥（生产必须修改）
JWT_ALGORITHM       # HS256
JWT_EXPIRE_MINUTES  # 默认 10080（7 天）

COOKIE_NAME = "access_token"
```

**签发 Token**：
```python
def create_access_token(user_id: str) -> str:
    payload = {
        "sub": user_id,                          # subject: user_id
        "iat": now,                              # issued at
        "exp": now + JWT_EXPIRE_MINUTES * 60,   # expiration
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
```

**解码 Token**：
```python
def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None
```

**为什么用 python-jose 而非 PyJWT？**
- 支持更多算法（未来如需 RS256 无缝切换）
- API 与 PyJWT 兼容，学习成本低

---

### 2. Dependencies (`dependencies.py`)

**职责**：FastAPI 依赖注入，提供两种用户获取模式。

#### `get_current_user` — 可选认证

```python
async def get_current_user(request: Request) -> Optional[dict]:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    user_id = decode_token(token)
    if not user_id:
        return None
    # 关键：验证用户是否真实存在于数据库中
    # 防止旧/失效 Cookie 导致 500
    user = get_user(user_id)
    if not user:
        return None
    return {"user_id": user_id}
```

**为什么验证 DB 存在性？**
- 用户可能删除了账号，但浏览器仍保留 Cookie
- 数据库可能经历了清理（如 `scripts/clean_data.py`）
- 不验证会导致后续 `link_space_to_user` 触发 FK 异常 → 500

#### `require_user` — 强制认证

```python
async def require_user(request: Request) -> dict:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
```

**使用场景**：

| 端点 | 依赖 | 说明 |
|------|------|------|
| `POST /spaces` | `get_current_user` | 访客可创建，登录后自动关联 |
| `POST /spaces/{id}/edges` | `get_current_user` | 访客可计算 |
| `POST /spaces/{id}/debates` | `get_current_user` | 访客可辩论 |
| `GET /spaces/my` | `require_user` | 必须登录 |
| `DELETE /spaces/{id}` | `require_user` | 必须登录 |

---

### 3. Password Auth (`password_auth.py`)

**职责**：bcrypt 密码哈希、注册、登录验证。

```python
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
PEPPER = ""  # 生产环境可通过环境变量注入额外盐值

def hash_password(password: str) -> str:
    return pwd_context.hash(password + PEPPER)

def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password + PEPPER, hashed)
```

**注册流程**：
```
UserRegisterRequest(username, password, email)
    │
    ▼
密码长度校验（≥6 位）
    │
    ▼
用户名唯一性校验（查询 store）
    │
    ▼
生成 user_id: usr_{uuid.hex[:12]}
    │
    ▼
创建 User → store.create_user(user)
保存密码哈希 → store.save_password(user_id, hash)
    │
    ▼
返回 User
```

**登录流程**：
```
UserLoginRequest(username, password)
    │
    ▼
查询用户 → store.get_user_by_username(username)
    │
    ▼
获取密码哈希 → store.get_password_hash(user_id)
    │
    ▼
bcrypt.verify(password, hash)
    │
    ▼
返回 User（Gateway 层签发 JWT + Set-Cookie）
```

---

### 4. GitHub OAuth (`github_oauth.py`)

**职责**：标准 OAuth2 授权码流程。

**流程**：
```
前端点击"GitHub 登录"
    │
    ▼
GET /auth/github/authorize
    → 返回 GitHub 授权 URL
    │
    ▼
浏览器跳转 GitHub 授权页
    │
    ▼
用户授权 → GitHub 重定向到 /auth/github/callback?code=xxx
    │
    ▼
Gateway:
  1. POST https://github.com/login/oauth/access_token（code → access_token）
  2. GET https://api.github.com/user（access_token → user info）
  3. 查询本地：store.get_user_by_oauth("github", github_id)
     ├── 已存在 → 直接返回已有 User
     └── 不存在 → 创建新 User + link_oauth
  4. 签发 JWT → Set-Cookie
  5. 重定向回前端 /
```

**用户创建规则**：
- `username` = GitHub login 名，或 `github_{id}`（fallback）
- `auth_provider` = `"github"`
- `avatar` = GitHub avatar_url
- OAuth 绑定记录存入 `oauth_accounts` 表

---

### 5. Store Dispatcher (`auth/store.py`)

**职责**：根据 `USE_DB` 切换内存或 PostgreSQL 后端。

```python
from services.shared.db_config import USE_DB

if USE_DB:
    from services.gateway.auth.db_store import (
        create_user, get_user, get_user_by_username, get_user_by_oauth,
        save_password, get_password_hash, link_oauth,
        link_space_to_user, get_user_spaces,
    )
else:
    from services.gateway.auth.memory_store import (...)
```

**存储函数清单**：

| 函数 | 说明 |
|------|------|
| `create_user(user)` | 创建/更新用户 |
| `get_user(user_id)` | 按 ID 查询用户 |
| `get_user_by_username(username)` | 按用户名查询 |
| `get_user_by_oauth(provider, provider_id)` | 按 OAuth 绑定查询 |
| `save_password(user_id, hash)` | 保存密码哈希 |
| `get_password_hash(user_id)` | 获取密码哈希 |
| `link_oauth(user_id, provider, provider_id)` | 绑定 OAuth 账号 |
| `link_space_to_user(user_id, space_id)` | 关联 Space 到用户 |
| `get_user_spaces(user_id)` | 获取用户的所有 Space ID |

---

### 6. PostgreSQL Auth Store (`auth/db_store.py`)

**Schema**: `auth`

**表结构**（ORM 定义见 `auth/models_db.py`）：

| 表 | 说明 | 关键约束 |
|----|------|----------|
| `auth.users` | 用户基础信息 | `user_id(PK)`, `username(UNIQUE)` |
| `auth.passwords` | bcrypt 密码哈希 | `user_id(PK, FK→users)` |
| `auth.oauth_accounts` | OAuth 绑定记录 | `provider_account_id(UNIQUE)` |
| `auth.user_spaces` | 用户-Space 关联 | `UNIQUE(user_id, space_id)` |

**ORM/DB 解耦**：
- `UserSpaceDB.space_id` 在 ORM 层为纯 `String` 列，**无 ForeignKey**
- DB 层通过 `scripts/fix_schema.py` 维护 `FK → core.spaces(space_id) ON DELETE CASCADE`
- 原因：`core.spaces` 属于 Core Service，Gateway 不应在 ORM 中硬引用

---

### 7. Auth Routes (Gateway `main.py`)

| 端点 | 方法 | 说明 | 认证要求 |
|------|------|------|----------|
| `GET /auth/github/authorize` | 返回 GitHub 授权 URL | 无 |
| `GET /auth/github/callback` | OAuth 回调，签发 Cookie | 无（code 参数） |
| `POST /auth/register` | 注册 + 自动登录（Set-Cookie） | 无 |
| `POST /auth/login` | 登录（Set-Cookie） | 无 |
| `GET /auth/me` | 获取当前用户信息 | Cookie（可选） |
| `POST /auth/logout` | 清除 Cookie | Cookie（可选） |
| `GET /spaces/my` | 获取当前用户的 Space 列表 | 必须登录 |

**Cookie 设置**（注册/登录/OAuth 回调）：
```python
response.set_cookie(
    key="access_token",
    value=token,
    httponly=True,      # 防止 XSS 窃取
    secure=False,       # 生产环境必须改为 True（HTTPS）
    samesite="lax",     # 允许同站跳转携带（OAuth 需要）
    max_age=60*60*24*7, # 7 天
)
```

---

## 关键设计决策

### 1. 为什么 Auth 内嵌在 Gateway？

- **减少服务数量**：不需要独立的 Auth Service，避免额外的网络跳转
- **Gateway 天然是入口**：所有请求都经过 Gateway，在这里做认证最自然
- **Cookie 简化前端**：前端只需配置 `credentials: 'include'`，无需手动管理 Token

### 2. 为什么用 Cookie 而非 Authorization Header？

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Cookie (选中)** | 前端零管理，自动携带，可设 HttpOnly | 需处理 CSRF（SameSite=Lax 缓解） |
| Authorization Header | 无 CSRF 风险，跨域灵活 | 前端需手动存储/刷新 Token |

本项目选择 Cookie  because：
- 前端是 SPA，与 Gateway 同域（Vite proxy）
- HttpOnly 防止 XSS 脚本窃取 Token
- SameSite=Lax 在防止 CSRF 的同时允许 OAuth 回调

### 3. 访客模式设计

```
未登录用户 ──► get_current_user() → None ──► 以访客身份继续
                                            │
                                            ▼
                                    Space.user_id = None
                                    不调用 link_space_to_user()
```

**为什么不是所有端点都强制登录？**
- 降低使用门槛，用户可立即体验核心功能
- "我的空间"等个性化功能才需要登录
- 与主流 SaaS（Notion、Figma）的访客体验一致

### 4. Stale Cookie 防御

`dependencies.py` 中的 `get_current_user` 不仅验证 JWT 签名，还验证用户是否存在于数据库：

```python
user = get_user(user_id)
if not user:
    return None  # 旧 Cookie 视为未登录，不抛异常
```

**解决的问题**：
- 用户删除账号后，浏览器 Cookie 仍在
- 数据库清理后，JWT 中的 user_id 已不存在
- 防止 `link_space_to_user` 触发 FK 异常 → 500

---

## 与 Gateway 其他模块的交互

### Space 创建时的用户关联

```python
@app.post("/spaces")
async def create_space(request: CreateSpaceRequest, user: Optional[dict] = Depends(get_current_user)):
    # ... 调用 Generator 生成 Agents ...
    space = Space(..., user_id=user["user_id"] if user else None)
    await _post(config.CORE_URL, "/spaces/ingest", space.model_dump())
    if user:
        link_space_to_user(user["user_id"], space.space_id)
    return space
```

### 获取我的 Spaces

```python
@app.get("/spaces/my")
async def get_my_spaces(user: dict = Depends(require_user)):
    space_ids = get_user_spaces(user["user_id"])
    spaces = []
    for sid in space_ids:
        data = await _get(config.CORE_URL, f"/spaces/{sid}")
        spaces.append(Space(**data))
    return spaces
```

---

## 配置说明

Auth 配置集中管理于 `services/shared/config.py`：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `JWT_SECRET_KEY` | `dev-secret-change-in-production` | JWT 签名密钥（**生产必须修改**） |
| `JWT_ALGORITHM` | `HS256` | JWT 算法 |
| `JWT_EXPIRE_MINUTES` | `10080`（7 天） | Token 过期时间 |
| `GITHUB_CLIENT_ID` | - | GitHub OAuth App Client ID（可选） |
| `GITHUB_CLIENT_SECRET` | - | GitHub OAuth App Client Secret（可选） |
| `GITHUB_REDIRECT_URI` | `http://localhost:8000/auth/github/callback` | 回调地址 |
| `USE_DB` | `false` | `true`=PostgreSQL auth schema |

---

## 安全注意事项

1. **生产环境必须修改 `JWT_SECRET_KEY`**：默认值仅用于开发
2. **生产环境必须开启 HTTPS + Secure Cookie**：当前 `secure=False` 仅用于本地
3. **bcrypt 版本兼容性**：`bcrypt>=5.0` 与 `passlib==1.7.4` 不兼容，需使用 `bcrypt<5.0`
4. **可选 Pepper**：`password_auth.py` 中 `PEPPER` 变量可在生产环境注入额外盐值
5. **SameSite=Lax 的权衡**：允许 OAuth 回调跳转携带 Cookie，但防 CSRF 能力弱于 Strict

---

## 相关文档

- [`docs/auth.md`](auth.md) — 认证系统使用指南和测试命令
- [`docs/database.md`](database.md) — 数据库设计（auth schema 表结构）
- [`docs/api-design.md`](api-design.md) — API 完整设计（Gateway 层接口）
