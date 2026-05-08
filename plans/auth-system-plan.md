# Plan: OAuth2 GitHub + 账号密码登录

## 一、现状分析

当前系统**无任何用户/认证机制**：
- Space 数据完全匿名，不关联任何用户
- 前端无登录页面、无登录状态管理
- 后端无用户表、无密码存储、无 JWT 签发
- 所有 API 均为公开访问

---

## 二、设计目标

1. **支持两种登录方式**：OAuth2 GitHub 登录 + 账号密码登录
2. **JWT 会话管理**：无状态，适合微服务架构
3. **向后兼容**：未登录用户仍可匿名使用（访客模式）
4. **最小侵入**：不新增独立 Auth 服务，认证逻辑内聚在 Gateway
5. **Space 归属**：登录后创建的 Space 关联当前用户，支持"我的空间"列表

---

## 三、方案：Gateway 内嵌认证（推荐）

不新增独立 Auth 服务，认证逻辑直接内聚在 Gateway 中。用户数据存储在 Core Service。理由：
- 当前项目规模小，5 个服务已足够
- 认证是 Gateway 的天然职责（统一入口、鉴权）
- 避免额外的服务间 HTTP 调用（Auth → Core 查用户）
- 未来如需拆分，Gateway 的 auth 代码可直接迁移为新服务

```
┌─────────────┐      ┌─────────────────────────────────────────────┐
│   Frontend  │─────►│  Gateway (8000)                             │
│  (port 5173)│      │  ┌───────────────────────────────────────┐   │
└─────────────┘      │  │ Auth Router (新增)                     │   │
                     │  │  /auth/github/authorize                │   │
                     │  │  /auth/github/callback                 │   │
                     │  │  /auth/register                        │   │
                     │  │  /auth/login                           │   │
                     │  │  /auth/me                              │   │
                     │  │  /auth/logout                          │   │
                     │  └───────────────────────────────────────┘   │
                     │              │                                │
                     │              ▼                                │
                     │  ┌───────────────────────────────────────┐   │
                     │  │ JWT Middleware (新增)                  │   │
                     │  │  从 Cookie 提取 token                 │   │
                     │  │  验证签名 + 解析 user_id              │   │
                     │  │  注入 request.state.user              │   │
                     │  └───────────────────────────────────────┘   │
                     └─────────────────────────────────────────────┘
                                    │
                                    ▼
                     ┌─────────────────────────────────────────────┐
                     │  Core Service (8001)                        │
                     │  ┌───────────────────────────────────────┐   │
                     │  │ Users Store (新增)                     │   │
                     │  │  _users, _passwords, _oauth_accounts   │   │
                     │  │  Space 关联 user_id (可选)             │   │
                     │  └───────────────────────────────────────┘   │
                     └─────────────────────────────────────────────┘
```

---

## 四、认证流程

### 4.1 OAuth2 GitHub 登录

```
1. 前端点击 "使用 GitHub 登录"
   │
   ▼
2. GET /auth/github/authorize
   后端返回 GitHub OAuth URL
   │
   ▼
3. 前端 window.location.href = GitHub OAuth URL
   │
   ▼
4. 用户在 GitHub 授权页确认
   │
   ▼
5. GitHub 重定向到 callback
   GET /auth/github/callback?code=xxx
   │
   ▼
6. 后端用 code 换取 GitHub access_token
   POST https://github.com/login/oauth/access_token
   │
   ▼
7. 后端用 access_token 获取 GitHub 用户信息
   GET https://api.github.com/user
   │
   ▼
8. 后端查找/创建用户，签发 JWT
   │
   ▼
9. 后端 Set-Cookie: access_token=xxx (httpOnly)
   前端重定向回首页
   │
   ▼
10. 前端 GET /auth/me 获取用户信息
```

**需要的环境变量**：
```bash
GITHUB_CLIENT_ID=your-github-oauth-app-id
GITHUB_CLIENT_SECRET=your-github-oauth-app-secret
GITHUB_REDIRECT_URI=http://localhost:8000/auth/github/callback
JWT_SECRET_KEY=your-random-secret-key-min-32-chars
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080  # 7天
```

### 4.2 账号密码登录

```
注册流程：
1. 前端 POST /auth/register
   { username: "xxx", password: "xxx" }
   │
   ▼
2. 后端校验：用户名唯一、密码长度 >= 6
   │
   ▼
3. 后端 bcrypt 哈希密码（cost=12）
   │
   ▼
4. 后端创建用户，签发 JWT
   │
   ▼
5. Set-Cookie，返回用户信息

登录流程：
1. 前端 POST /auth/login
   { username: "xxx", password: "xxx" }
   │
   ▼
2. 后端查找用户，bcrypt.verify 密码
   │
   ▼
3. 签发 JWT，Set-Cookie
```

### 4.3 JWT 设计

```python
# Payload
{
    "sub": "user_xxx",          # user_id
    "username": "xxx",
    "avatar": "https://...",
    "provider": "github",        # "github" | "password"
    "exp": 1715152800,           # 过期时间
    "iat": 1714548000,           # 签发时间
}

# 存储方式：httpOnly Cookie
# Cookie 属性：
# - httpOnly: true   (JS 无法读取，防 XSS)
# - secure: false    (开发环境，生产环境设为 true)
# - sameSite: lax    (允许跨站 GET 跳转)
# - maxAge: 7天
```

### 4.4 访客模式（向后兼容）

```
所有现有 API 保持兼容：
- 未登录用户仍可创建 Space、查看 Space、触发辩论
- Space 的 user_id 字段为 null（匿名）
- 登录后创建的 Space 关联 user_id
- 新增 /spaces/my 接口，返回当前用户的 Space 列表
```

---

## 五、数据模型

### 5.1 新增共享模型

```python
# services/shared/models.py

class AuthProvider(str, Enum):
    GITHUB = "github"
    PASSWORD = "password"


class User(BaseModel):
    user_id: str
    username: str
    email: Optional[str] = None
    avatar: Optional[str] = None
    auth_provider: AuthProvider
    created_at: int  # unix timestamp


class PasswordAccount(BaseModel):
    user_id: str
    password_hash: str  # bcrypt hash


class OAuthAccount(BaseModel):
    user_id: str
    provider: AuthProvider
    provider_account_id: str  # GitHub user id
    provider_username: str
    access_token: Optional[str] = None


class UserRegisterRequest(BaseModel):
    username: str
    password: str


class UserLoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User
```

### 5.2 Core Store 扩展

```python
# services/core/store.py 新增

_users: Dict[str, User] = {}
_passwords: Dict[str, str] = {}  # user_id -> bcrypt_hash
_oauth_accounts: Dict[str, str] = {}  # "github:{provider_id}" -> user_id
_user_spaces: Dict[str, list[str]] = {}  # user_id -> [space_id, ...]


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


def verify_password(user_id: str, password: str) -> bool:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hash_ = _passwords.get(user_id)
    return hash_ and pwd_context.verify(password, hash_)


def link_oauth(user_id: str, provider: str, provider_id: str) -> None:
    _oauth_accounts[f"{provider}:{provider_id}"] = user_id


def link_space_to_user(user_id: str, space_id: str) -> None:
    if user_id not in _user_spaces:
        _user_spaces[user_id] = []
    if space_id not in _user_spaces[user_id]:
        _user_spaces[user_id].append(space_id)


def get_user_spaces(user_id: str) -> list[str]:
    return _user_spaces.get(user_id, [])
```

### 5.3 Space 模型扩展（user_id 为可选）

```python
# services/shared/models.py Space 模型
class Space(BaseModel):
    space_id: str
    query: str
    dimensions: dict[str, Dimension]
    agents: list[Agent]
    metadata: SpaceMetadata
    user_id: Optional[str] = None  # 新增：null 表示匿名
```

---

## 六、后端改动清单

### 6.1 新增依赖

```
# requirements.txt 新增
python-jose[cryptography]==3.3.0   # JWT 签发/验证
passlib[bcrypt]==1.7.4             # bcrypt 密码哈希
python-multipart==0.0.9            # OAuth2 表单解析
httpx==0.27.0                      # 已存在，用于 GitHub API 调用
```

### 6.2 Gateway 新增文件

```
services/gateway/
├── main.py                    # 修改：新增 auth router + JWT middleware
├── auth/
│   ├── __init__.py
│   ├── jwt.py                 # JWT 签发/验证工具
│   ├── github_oauth.py        # GitHub OAuth2 流程
│   └── password_auth.py       # 密码注册/登录/验证
└── dependencies.py            # FastAPI Depends：get_current_user
```

### 6.3 Gateway main.py 修改点

1. **新增 JWT 依赖注入**：
```python
from services.gateway.auth.jwt import get_current_user

# 现有路由增加可选 user 参数
@app.post("/spaces")
async def create_space(request: CreateSpaceRequest, user: Optional[User] = Depends(get_current_user)):
    # ... 创建 Space ...
    if user:
        space.user_id = user.user_id
        core_store.link_space_to_user(user.user_id, space.space_id)
```

2. **新增 Auth Router**：
```python
# /auth/github/authorize
# /auth/github/callback
# /auth/register
# /auth/login
# /auth/me
# /auth/logout
```

3. **CORS 配置更新**：
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,  # 允许携带 Cookie
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 6.4 Core Service 修改点

1. `store.py`：新增用户相关存储（见 5.2）
2. `routers/spaces.py`：新增 `GET /spaces/my`（当前用户的 Space 列表）
3. Space 模型增加 `user_id` 字段

---

## 七、前端改动清单

### 7.1 新增文件

```
frontend/src/
├── auth/
│   ├── AuthContext.tsx         # 登录状态管理（Context + useReducer）
│   ├── AuthModal.tsx           # 登录/注册弹窗（GitHub + 密码）
│   └── useAuth.ts              # Auth hook
├── api.ts                      # 修改：增加 auth 相关 API
└── components/
    ├── LandingPage.tsx          # 修改：添加登录按钮
    └── SpacePage.tsx            # 修改：头部显示用户头像 + 登出
```

### 7.2 AuthContext 状态设计

```typescript
interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

type AuthAction =
  | { type: 'LOGIN'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean }
```

### 7.3 API 客户端修改

```typescript
// api.ts 新增
export const api = {
  // ... 现有 API ...
  
  // Auth
  githubAuthorize: () => get<{ url: string }>('/auth/github/authorize'),
  register: (req: UserRegisterRequest) => post<User>('/auth/register', req),
  login: (req: UserLoginRequest) => post<User>('/auth/login', req),
  getMe: () => get<User>('/auth/me'),
  logout: () => post<void>('/auth/logout'),
  
  // User spaces
  getMySpaces: () => get<Space[]>('/spaces/my'),
}
```

### 7.4 Cookie + Credentials

```typescript
// fetch 请求必须携带 Cookie
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',  // 关键：携带 Cookie
  })
  // ...
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',  // 关键：携带 Cookie
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  // ...
}
```

### 7.5 LandingPage 登录入口

```
┌─────────────────────────────────────┐
│  🧭 决策罗盘                          │
│                                     │
│  [输入框]                           │
│                                     │
│  [开始探索]  或  👤 登录             │
│                                     │
│  热门问题...                        │
└─────────────────────────────────────┘

点击"登录"弹出 AuthModal：
┌─────────────────────────────────────┐
│  登录 / 注册                         │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 🔷 使用 GitHub 登录           │  │
│  └───────────────────────────────┘  │
│            ─── 或 ───               │
│  用户名 [__________]                │
│  密码   [__________]                │
│                                     │
│  [登录]    [注册]                   │
└─────────────────────────────────────┘
```

### 7.6 SpacePage 用户状态

```
┌──────────────────────────────────────────┐
│  问题标题...            [👤 用户名 ▼] [登出] │
└──────────────────────────────────────────┘
下拉菜单：
- 我的认知空间
- 账号设置
- 登出
```

---

## 八、环境变量

```bash
# .env.example 新增

# ── GitHub OAuth ──
GITHUB_CLIENT_ID=your-github-oauth-app-id
GITHUB_CLIENT_SECRET=your-github-oauth-app-secret
GITHUB_REDIRECT_URI=http://localhost:8000/auth/github/callback

# ── JWT ──
JWT_SECRET_KEY=change-this-to-a-random-string-at-least-32-chars-long
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080  # 7天

# ── Password Hash ──
# 可选：增加 pepper（全局盐）增强安全性
# PASSWORD_PEPPER=another-random-string
```

---

## 九、安全设计

| 风险 | 缓解措施 |
|------|----------|
| XSS 窃取 JWT | httpOnly Cookie，JS 无法读取 token |
| CSRF 攻击 | sameSite=lax + 所有修改操作用 POST/PUT/DELETE |
| 密码泄露 | bcrypt cost=12，单机哈希耗时 ~200ms |
| JWT 密钥泄露 | 环境变量配置，生产环境使用至少 256-bit 随机密钥 |
| GitHub OAuth state 伪造 | callback 校验 state 参数（可选，当前规模可省略） |
| 暴力破解密码 | Gateway 层增加限流（速率限制，可选） |
| SQL 注入 | 当前内存存储，无 SQL。未来迁移 PostgreSQL 时用 ORM 参数化查询 |

---

## 十、实现步骤

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | 新增依赖 | `requirements.txt` |
| 2 | 新增用户模型 | `services/shared/models.py` |
| 3 | 新增 Core Store 用户存储 | `services/core/store.py` |
| 4 | 新增 JWT 工具 | `services/gateway/auth/jwt.py` |
| 5 | 新增 GitHub OAuth | `services/gateway/auth/github_oauth.py` |
| 6 | 新增密码认证 | `services/gateway/auth/password_auth.py` |
| 7 | Gateway 集成 auth router + middleware | `services/gateway/main.py` |
| 8 | Core Service 新增 user spaces API | `services/core/routers/spaces.py` |
| 9 | 前端新增 AuthContext | `frontend/src/auth/AuthContext.tsx` |
| 10 | 前端新增 AuthModal | `frontend/src/auth/AuthModal.tsx` |
| 11 | 前端修改 API 客户端（credentials） | `frontend/src/api.ts` |
| 12 | 前端修改 LandingPage（登录入口） | `frontend/src/components/LandingPage.tsx` |
| 13 | 前端修改 SpacePage（用户头像） | `frontend/src/components/SpacePage.tsx` |
| 14 | 更新 .env.example | `.env.example` |
| 15 | 测试全流程 | - |

---

## 十一、与微服务架构的兼容性

当前架构特点：
- Gateway 是统一入口（所有前端请求都经过 Gateway）
- Gateway 负责路由到下游服务
- 下游服务（Core/Compute/Generator/Aggregator）无认证概念

**认证集成方式**：
1. Gateway 在请求入口验证 JWT
2. 验证通过后，将 `user_id` 注入到下游服务请求中（通过 HTTP header 或请求体）
3. 下游服务无需改动认证逻辑，只需读取 user_id 即可

```
Frontend ──► Gateway ──► Core Service
                 │              │
                 │ JWT 验证      │ 读取 X-User-ID header
                 │              │
                 ▼              ▼
           注入 user_id    关联 Space 到用户
```

**Core Service 最小改动**：
- Space 模型增加 `user_id`（可选，null = 匿名）
- 新增 `GET /spaces/my` 接口
- 创建 Space 时读取请求头中的 user_id

---

*方案版本：v1.0*  
*对应架构版本：微服务 v0.2.0*
