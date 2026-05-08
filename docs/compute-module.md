# Compute Service 模块说明

> 端口：8003  
> 职责：纯数学计算，无状态，无持久化存储  
> 特点：可水平扩展，不依赖 LLM，计算结果完全可复现

---

## 1. 模块定位

Compute Service 是整个系统中**唯一不含任何 LLM 调用**的服务。它的职责只有两件：

1. **Edge 计算**：根据 Agent 语义 embedding 计算两两之间的冲突分数
2. **Metrics 计算**：根据用户行为轨迹计算认知指标

```
┌─────────────┐
│  Compute    │
│  Service    │
│  (port 8003)│
└──────┬──────┘
       │
       ├──► embedder.py     → 文本 → 语义向量 (local/openai/mock)
       │
       ├──► edge_calculator.py → 向量 → 冲突边 + 空间统计
       │
       └──► metrics_calculator.py → 轨迹 → 认知指标
```

**关键设计原则**：Compute 只负责"计算真实值"。它不会生成任何内容，只将输入数据按既定公式转换为输出。因此它是整个系统中最可靠、最可测试的模块。

---

## 2. 配置说明

所有配置通过环境变量读取（定义在 `services/shared/config.py`）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `COMPUTE_EMBED_BACKEND` | `mock` | Embedding 后端：`local` / `openai` / `mock` |
| `COMPUTE_LOCAL_MODEL` | `all-MiniLM-L6-v2` | Local 后端使用的模型名称 |
| `COMPUTE_OPENAI_MODEL` | `text-embedding-3-small` | OpenAI 后端使用的模型名称 |

### 三种后端模式

#### 模式一：mock（默认）
```bash
COMPUTE_EMBED_BACKEND=mock
```
- **无需任何额外依赖**
- 使用 **39 个领域的词典 + jieba 中文分词** 生成语义向量
- 相比旧版的 MD5 哈希伪向量，具有真实的语义区分度：
  - 同一领域的 Agent 相似度高
  - 不同领域的 Agent 相似度低
- 适合：快速启动、无网络环境、单元测试

#### 模式二：local（推荐）
```bash
pip install sentence-transformers
COMPUTE_EMBED_BACKEND=local
```
- 使用 `sentence-transformers` 加载预训练模型
- 默认模型 `all-MiniLM-L6-v2`（~80MB，384维）
- 完全本地运行，不依赖网络/API key
- 推理速度：CPU 上 < 10ms/文本
- 语义质量：STS 基准 Spearman ~0.84
- 适合：生产环境、Docker 部署、追求真实语义

#### 模式三：openai
```bash
COMPUTE_EMBED_BACKEND=openai
# 需同时配置 OPENAI_API_KEY
```
- 直接调用 OpenAI Embedding API
- 默认模型 `text-embedding-3-small`（1536维）
- 最高质量，但有 API 费用
- 适合：已部署 OpenAI 密钥的生产环境

---

## 3. 核心逻辑

### 3.1 Edge 计算流程

```
输入：Space（含 Agent 列表）
    │
    ├── 对每个 Agent，构造文本："{name}: {summary} {persona}"
    │
    ├── 调用 embedder.embed_batch() 获取语义向量
    │       ├── mock: jieba 分词 → 领域词典匹配 → 归一化向量
    │       ├── local: SentenceTransformer.encode()
    │       └── openai: OpenAI embeddings.create()
    │
    ├── 对所有 Agent 两两组合 (n choose 2)
    │   └── cosine_distance(emb_a, emb_b)
    │
    ├── 根据阈值分类 conflict_type
    │   └── >0.7 fundamental / >0.3 partial / <=0.3 minor
    │
    └── 计算空间统计
        ├── conflict_density = avg(conflict_score)
        ├── diversity_index = fundamental_count / total_edges
        └── consensus_clusters = 1 (简化实现)

输出：list[Edge] + SpaceStats
```

### 3.2 Metrics 计算流程

```
输入：Space + Trajectory
    │
    ├── coverage_area
    │   └── 用户访问过的 Agent 坐标 → ConvexHull 面积
    │
    ├── depth_score
    │   └── debate_count * 0.3 + total_dwell / 300
    │
    ├── breadth_score
    │   └── visited_agents / total_agents
    │
    ├── conflict_engagement
    │   └── debate_actions / (total_actions / 2)
    │
    ├── journey_stage
    │   └── 状态机：exploration → perspective → discovery → resolution
    │
    └── suggested_next
        └── 根据 journey_stage 返回固定建议映射

输出：CognitiveMetrics（同时修改 Trajectory 的 stage 和 suggestion）
```

---

## 4. 计算公式与依据

### 4.1 Embedding → 语义向量

**输入文本**：`"{agent.name}: {agent.summary} {agent.persona}"`

**Mock 模式计算**：
```python
# 1. jieba 分词
tokens = jieba.cut(text)

# 2. 匹配 39 个领域的关键词 + 7 个通用关键词
for domain in DOMAINS:
    matches = sum(1 for kw in DOMAIN_KEYWORDS[domain] if kw in tokens)
    universal = sum(1 for kw in UNIVERSAL_KEYWORDS if kw in tokens)
    vec[domain] = sqrt(matches + universal * 0.05)

# 3. L2 归一化
vec = vec / ||vec||
```

**设计依据**：
- 每个维度代表该 Agent 与某个领域的关联强度
- 通用关键词提供基线重叠，避免完全正交
- 开方运算放大强信号、抑制弱信号
- 归一化确保 cosine similarity 只比较方向，不比较幅度

---

### 4.2 Cosine Distance（余弦距离）

**公式**：
```
cosine_similarity(A, B) = (A · B) / (||A|| × ||B||)
cosine_distance(A, B) = 1 - cosine_similarity(A, B)
```

**数学依据**：
- 余弦相似度衡量两个向量在方向上的接近程度
- 值域 [-1, 1]：1 表示同向（语义完全一致），-1 表示反向（语义完全对立）
- 对归一化单位向量，值域压缩为 [0, 1]
- 转换为 distance 后：0 表示完全一致，1 表示完全对立

**代码实现**：
```python
dot = sum(x * y for x, y in zip(a, b))
norm_a = math.sqrt(sum(x * x for x in a))
norm_b = math.sqrt(sum(x * x for x in b))
similarity = dot / (norm_a * norm_b)
similarity = max(-1.0, min(1.0, similarity))  # 浮点保护
distance = 1.0 - similarity
```

---

### 4.3 Conflict Type 分类

**阈值规则**：
```
score > 0.70  →  fundamental   (根本性冲突)
score > 0.30  →  partial       (部分冲突)
score ≤ 0.30  →  minor         (轻微分歧)
```

**业务依据**：
- `fundamental`（>0.7）：语义差异极大，立场对立明显，应优先推荐辩论
- `partial`（0.3~0.7）：有显著分歧但非根本对立
- `minor`（≤0.3）：观点相近，分歧不显著

**注意**：阈值是**业务规则**而非数学推导。实际部署后可根据用户反馈数据（如 debate 点击率）进行 A/B 测试调优。

---

### 4.4 Coverage Area（覆盖面积）

**公式**：
```python
def _compute_coverage_area(positions):
    if len(positions) < 3:
        return 0.0
    hull = MultiPoint(positions).convex_hull
    return hull.area
```

**输入**：用户访问过的 Agent 的 `(authority, novelty)` 坐标点  
**方法**：计算这些点的**凸包面积**（Convex Hull Area）

**依据**：
- 类比地理探索：访问点越分散，认知覆盖范围越大
- 凸包是包含所有点的最小凸多边形
- 坐标系为 `[0,1] × [0,1]`，理论最大面积为 1.0
- 访问点 < 3 时无法构成多边形，面积为 0

---

### 4.5 Depth Score（深度分数）

**公式**：
```
depth_score = min(1.0, debate_count × 0.3 + total_dwell_time / 300)
```

**变量**：
- `debate_count`：用户触发的辩论次数
- `total_dwell_time`：用户在各页面的总停留时间（秒）

**依据**：
- `debate_count × 0.3`：每次辩论代表一次深度认知交互。触发 4 次即达满分
- `total_dwell_time / 300`：每 5 分钟停留贡献 1.0 分
- `min(1.0, ...)`：归一化到 [0, 1]
- **业务意义**：深度 = 参与深度（辩论）+ 时间投入（停留）

---

### 4.6 Breadth Score（广度分数）

**公式**：
```
breadth_score = visited_unique_agents / total_agents
```

**依据**：
- 最简单的覆盖度指标：看了多少个不同的 Agent
- 与 Coverage Area 的区别：Breadth 是计数，Coverage 是空间面积
- 两者可能不一致（如看了 3 个聚在一起的 Agent，Breadth 高但 Coverage 低）

---

### 4.7 Conflict Engagement（冲突参与度）

**公式**：
```
conflict_engagement = min(1.0, debate_actions / max(1, total_actions / 2))
```

**依据**：
- 衡量用户对"冲突/辩论"的偏好程度
- 分母 `total_actions / 2`：假设"正常"用户行为中约一半与冲突相关
- debate_actions 超过总行为一半时 Engagement 达 1.0
- **业务意义**：高 Engagement = 用户不是走马观花，而是真正关注分歧

---

### 4.8 Journey Stage（认知阶段）

**状态机**：
```
exploration
    └── view >= 2 ──► perspective_gathering
                          └── expand ──► conflict_discovery
                                              └── debate ──► conflict_resolution
```

**各阶段定义**：

| 阶段 | 触发条件 | 业务含义 |
|------|----------|----------|
| `exploration` | 初始状态，或 view < 2 | 用户刚开始探索 |
| `perspective_gathering` | view >= 2 | 已收集多个视角 |
| `conflict_discovery` | 触发过 expand | 发现了观点差异 |
| `conflict_resolution` | 触发过 debate | 已参与辩论 |

**依据**：
- 基于 Kolb 体验式学习理论：具体经验 → 反思观察 → 抽象概念化 → 主动实验
- 状态**单调递增**（不回退），反映认知的不可逆深入

---

### 4.9 Space Stats（空间统计）

**Conflict Density（冲突密度）**：
```
conflict_density = avg(conflict_score for all edges)
```
- 整个空间的平均冲突分数
- 反映问题的"争议程度"

**Diversity Index（多样性指数）**：
```
diversity_index = fundamental_count / total_edges
```
- 根本性冲突占比
- 反映观点的"极化程度"

**Consensus Clusters（共识聚类数）**：
- 当前简化实现：`1 if edges else 0`
- **未来改进**：Union-Find 连通分量算法，将 conflict_score < 0.3 的 Agent 视为同一聚类

---

## 5. 服务间调用关系

```
Compute Service (8003)
    │
    ├──► Core Service (8001)        ← 读取 Space、Trajectory
    │       GET /spaces/{space_id}
    │
    ├──► Generator Service (8002)   ← 仅旧版依赖，新版已移除
    │       [已移除] 不再通过 HTTP 获取 embeddings
    │       Compute 自己计算 embedding（local/openai/mock）
    │
    └──► 无其他下游依赖
```

**重要变更**：Compute 不再通过 HTTP 调用 Generator 获取 embeddings。嵌入计算已内聚到 Compute 内部，这是为了保证：
1. **计算真实性**：Compute 自己控制 embedding 质量，不受 Generator mock 模式影响
2. **服务解耦**：Compute 与 Generator 之间无运行时依赖
3. **可测试性**：Compute 的输入输出完全确定，便于单元测试

---

## 6. 性能特征

| 指标 | Mock 模式 | Local 模式 | OpenAI 模式 |
|------|-----------|------------|-------------|
| 首次请求延迟 | ~10ms | ~2-3s（模型加载） | ~500ms（API RTT） |
| 后续请求延迟 | ~5ms | ~10ms | ~200ms |
| 内存占用 | ~0 | ~100MB（模型） | ~0 |
| 网络依赖 | 无 | 首次需下载模型 | 每次需调用 API |
| 费用 | 无 | 无 | 按 token 计费 |

---

## 7. 测试验证

```bash
# 验证服务健康
curl http://localhost:8003/health

# 验证 Edge 计算（需先创建 Space）
curl -X POST http://localhost:8003/compute/edges/compute \
  -H "Content-Type: application/json" \
  -d '{"space_id": "space_xxx"}'

# 验证 Metrics 计算
curl -X POST http://localhost:8003/compute/metrics/compute \
  -H "Content-Type: application/json" \
  -d '{"space": {...}, "trajectory": {...}}'
```

---

## 8. 未来扩展

| 方向 | 描述 |
|------|------|
| Consensus Clusters | 实现 Union-Find 连通分量算法，精确计算观点聚类数 |
| Edge Weighted Graph | 将冲突图用于路径推荐（最短路径 = 最少冲突的视角切换路线） |
| Real-time Metrics | 前端通过 WebSocket 实时推送 Metrics 更新 |
| Custom Formulas | 允许用户配置自己的指标公式（通过环境变量或数据库配置） |
