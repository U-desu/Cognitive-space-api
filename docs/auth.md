# 认证系统设计文档

> 本文档描述 Cognitive Space API 的认证系统使用指南和快速参考。
>
> 对应架构版本：微服务 v0.2.0  
> 文档版本：v2.0

---

## 架构决策

**Gateway 内嵌认证，不新增服务。**

- JWT 存储在 httpOnly Cookie 中，前端通过 `credentials: 'include'` 自动携带
- 认证逻辑完全在 Gateway 层处理，不增加微服务数量
- 用户数据存储在 PostgreSQL `auth` schema（或内存模式），由 `USE_DB` 切换
- 向后兼容：所有核心 API 保持公开访问，未登录用户仍可匿名创建 Space

---

## 认证方式

| 方式 | 端点 | 说明 |
|------|------|------|
| **密码注册/登录** | `POST /auth/register`, `POST /auth/login` | bcrypt(cost=12) 哈希，密码≥6位 |
| **GitHub OAuth** | `GET /auth/github/authorize`, `GET /auth/github/callback` | 标准 OAuth2 授权码流程 |
| **访客模式** | 无需任何端点 | 直接访问核心功能 |

---

## JWT + Cookie 机制

```
登录成功 → 服务端生成 JWT → Set-Cookie: access_token=<jwt>; HttpOnly; SameSite=Lax
后续请求 → 浏览器自动携带 Cookie → Gateway 解码 JWT → 注入 user 到路由
```

### Cookie 属性

| 属性 | 值 | 说明 |
|------|-----|------|
| `HttpOnly` | `true` | 防止 XSS 脚本窃取 |
| `SameSite` | `Lax` | 允许同站跳转携带（OAuth callback 需要） |
| `Secure` | `false`（开发）/ `true`（生产） | 生产环境必须 HTTPS |
| `Max-Age` | `7天`（默认 10080 分钟） | 可配置 |

---

## 访客模式兼容

```python
# Gateway 依赖注入
async def get_current_user(request: Request) -> Optional[dict]:
    # 未登录返回 None，不抛 401
    token = request.cookies.get("access_token")
    if not token:
        return None
    user_id = decode_token(token)
    if not user_id:
        return None
    # 验证用户是否真实存在于数据库（防止旧 Cookie 导致 500）
    user = get_user(user_id)
    if not user:
        return None
    return {"user_id": user_id}

async def require_user(request: Request) -> dict:
    # 强制登录，未登录抛 401
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
```

### 端点认证策略

| 端点 | 依赖 | 说明 |
|------|------|------|
| `POST /spaces` | `get_current_user` | 访客可创建，登录后自动关联 user_id |
| `POST /spaces/{id}/edges` | `get_current_user` | 访客可计算 Edge |
| `POST /spaces/{id}/debates` | `get_current_user` | 访客可触发辩论 |
| `POST /spaces/{id}/agents/{id}/expand` | `get_current_user` | 访客可展开 Agent |
| `GET /spaces/{id}/trajectory` | `get_current_user` | 访客可查看轨迹 |
| `POST /spaces/{id}/export` | `get_current_user` | 访客可导出 |
| `GET /spaces/my` | `require_user` | 必须登录 |
| `DELETE /spaces/{id}` | `require_user` | 必须登录 |

---

## GitHub OAuth 流程

```
前端点击"GitHub 登录"
    │
    ▼
GET /auth/github/authorize  → 返回 GitHub 授权 URL
    │
    ▼
浏览器跳转 GitHub 授权页
    │
    ▼
用户授权后 GitHub 重定向到 /auth/github/callback?code=xxx
    │
    ▼
Gateway 用 code 换 access_token → 获取 GitHub 用户信息
    │
    ▼
查找/创建本地 User → 签发 JWT → Set-Cookie
    │
    ▼
重定向回前端首页 /
```

---

## API 端点

### 认证

| 方法 | 端点 | 说明 | 认证要求 |
|------|------|------|----------|
| `GET` | `/auth/github/authorize` | 获取 GitHub 授权 URL | 无 |
| `GET` | `/auth/github/callback` | GitHub OAuth 回调 | 无（code 参数） |
| `POST` | `/auth/register` | 用户名密码注册 + 自动登录 | 无 |
| `POST` | `/auth/login` | 用户名密码登录 | 无 |
| `GET` | `/auth/me` | 获取当前用户信息 | Cookie（可选） |
| `POST` | `/auth/logout` | 登出（清除 Cookie） | Cookie（可选） |

### 用户空间

| 方法 | 端点 | 说明 | 认证要求 |
|------|------|------|----------|
| `GET` | `/spaces/my` | 获取当前用户创建的所有 Space | 必须登录 |

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `JWT_SECRET_KEY` | `dev-secret-change-in-production` | JWT 签名密钥（**生产必须修改**） |
| `JWT_ALGORITHM` | `HS256` | JWT 算法 |
| `JWT_EXPIRE_MINUTES` | `10080`（7天） | Token 过期时间 |
| `GITHUB_CLIENT_ID` | - | GitHub OAuth App Client ID（可选） |
| `GITHUB_CLIENT_SECRET` | - | GitHub OAuth App Client Secret（可选） |
| `GITHUB_REDIRECT_URI` | `http://localhost:8000/auth/github/callback` | GitHub 回调地址 |
| `USE_DB` | `false` | `true`=PostgreSQL auth schema |

---

## 代码结构

```
services/gateway/
├── auth/                        # 认证模块
│   ├── jwt.py                   # JWT 签发/解码/依赖注入
│   ├── password_auth.py         # bcrypt 密码注册/登录
│   ├── github_oauth.py          # GitHub OAuth 流程
│   ├── store.py                 # 存储分发器（memory/db）
│   ├── memory_store.py          # 内存存储（USE_DB=false）
│   ├── db_store.py              # PostgreSQL 存储（USE_DB=true）
│   └── models_db.py             # Auth schema ORM 模型
├── dependencies.py              # get_current_user, require_user
└── main.py                      # 认证路由 + 业务编排

frontend/src/
├── auth/
│   ├── AuthContext.tsx          # 全局认证状态
│   ├── AuthModal.tsx            # 登录/注册弹窗
│   └── useAuth.ts               # 认证 Hook
├── api.ts                       # API 客户端（credentials: 'include'）
└── api-types.ts                 # TypeScript 类型定义
```

---

## 安全注意事项

1. **生产环境必须设置 `JWT_SECRET_KEY`**：默认的 dev-secret 仅用于开发
2. **生产环境必须开启 HTTPS + Secure Cookie**：当前 `secure=False` 仅用于本地开发
3. **bcrypt 版本兼容性**：`bcrypt>=5.0` 与 `passlib==1.7.4` 不兼容，需使用 `bcrypt<5.0`
4. **可选 pepper**：`password_auth.py` 中 `PEPPER` 变量可在生产环境通过环境变量注入额外盐值
5. **Stale Cookie 防御**：`get_current_user` 验证 JWT 后还会查询数据库确认用户存在，防止旧 Cookie 导致 500

---

## 测试命令

```bash
# 注册（自动设置 Cookie）
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456","email":"test@example.com"}' \
  -c cookies.txt

# 登录
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456"}' \
  -c cookies.txt

# 获取当前用户
curl http://localhost:8000/auth/me -b cookies.txt

# 创建 Space（自动关联用户）
curl -X POST http://localhost:8000/spaces \
  -H "Content-Type: application/json" \
  -d '{"query":"AI ethics"}' \
  -b cookies.txt

# 获取我的 Spaces
curl http://localhost:8000/spaces/my -b cookies.txt

# 登出
curl -X POST http://localhost:8000/auth/logout -b cookies.txt -c cookies.txt
```

---

## 相关文档

- [`docs/auth-module.md`](auth-module.md) — Auth 模块完整架构设计
- [`docs/database.md`](database.md) — 数据库设计（auth schema 表结构）
- [`docs/api-design.md`](api-design.md) — API 完整设计
