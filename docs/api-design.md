# Cognitive Space API 设计（v3）

## 核心概念

```
┌─────────────────────────────────────────┐
│           🧠 认知空间（Cognitive Space）   │
│                                         │
│     novelty/diversity (Y轴)             │
│         ↑                               │
│    ● AI创业者(0.8, 0.9)                 │
│         │    ╲ 冲突边                    │
│    ●投资人(0.7,0.6) ───── ● 大厂高管     │
│         │              (0.9, 0.3)        │
│         └────────→ authority (X轴)      │
│                                         │
│    用户轨迹: ──→──→──→                  │
│    认知扩展指数 = 轨迹覆盖面积             │
└─────────────────────────────────────────┘
```

## 数据模型

### Agent（认知节点）

```json
{
  "agent_id": "agent_001",
  "name": "AI创业者",
  "persona": "连续创业者，窗口期敏感",
  "position": {
    "authority": 0.82,
    "novelty": 0.91
  },
  "stance": "pro",
  "confidence": 0.85,
  "domain": "startup"
}
```

### Edge（认知冲突边）

```json
{
  "edge_id": "edge_001",
  "source": "agent_001",
  "target": "agent_002",
  "conflict_score": 0.78,
  "debate_triggered": false,
  "consensus_points": ["AI是趋势"],
  "divergence_points": ["时机判断", "风险偏好"]
}
```

### Trajectory（用户认知轨迹）

```json
{
  "trajectory_id": "traj_001",
  "points": [
    {"agent_id": "agent_001", "timestamp": 0, "action": "view"},
    {"agent_id": "agent_002", "timestamp": 15, "action": "expand"},
    {"agent_id": "edge_001", "timestamp": 45, "action": "debate"}
  ],
  "coverage_area": 0.47,
  "depth_score": 0.73,
  "breadth_score": 0.65
}
```

## API 端点

### 1. `POST /spaces` — 创建认知空间

**输入**：
```json
{
  "query": "我是否应该从大厂离职去做AI创业？",
  "user_context": {
    "industry": "tech",
    "seniority": "5y",
    "risk_preference": "moderate"
  }
}
```

**输出**：
```json
{
  "space_id": "space_abc123",
  "query": "我是否应该从大厂离职去做AI创业？",
  "dimensions": {
    "x": {"name": "authority", "label": "权威度", "range": [0, 1]},
    "y": {"name": "novelty", "label": "创新度", "range": [0, 1]}
  },
  "agents": [
    {
      "agent_id": "agent_001",
      "name": "AI创业者",
      "position": {"authority": 0.75, "novelty": 0.92},
      "stance": "pro",
      "summary": "窗口期有限，AI基础设施已成熟"
    },
    {
      "agent_id": "agent_002",
      "name": "大厂高管",
      "position": {"authority": 0.88, "novelty": 0.35},
      "stance": "con",
      "summary": "体系内积累比盲目创业更稳妥"
    },
    {
      "agent_id": "agent_003",
      "name": "早期投资人",
      "position": {"authority": 0.82, "novelty": 0.68},
      "stance": "neutral",
      "summary": "关键在PMF验证，不是辞职本身"
    }
  ],
  "metadata": {
    "space_type": "career_decision",
    "complexity": "high",
    "estimated_nodes": 5
  }
}
```

### 2. `POST /spaces/{space_id}/perspectives` — 生成认知视角

**输入**：
```json
{
  "agent_ids": ["agent_001", "agent_002", "agent_003"],
  "context": {
    "shared_background": "用户5年大厂AI经验",
    "depth": "detailed"
  }
}
```

**输出**：
```json
{
  "perspectives": [
    {
      "agent_id": "agent_001",
      "content": "现在不创业，以后窗口更小...",
      "key_claims": [
        {"claim": "AI应用层窗口期约18个月", "confidence": 0.82},
        {"claim": "大厂经验在创业中可转化为资源", "confidence": 0.78}
      ],
      "evidence": ["2024年AI融资数据", "头部AI公司成立时间"],
      "position": {"authority": 0.75, "novelty": 0.92}
    }
  ],
  "generation_metrics": {
    "latency_ms": 1200,
    "total_tokens": 3584
  }
}
```

### 3. `POST /spaces/{space_id}/edges` — 计算认知冲突边

**输出**：
```json
{
  "edges": [
    {
      "edge_id": "edge_001",
      "source": "agent_001",
      "target": "agent_002",
      "conflict_score": 0.84,
      "conflict_type": "fundamental",
      "shared_ground": ["AI是趋势", "需要准备"],
      "divergence_axes": [
        {"axis": "时机判断", "a_stance": "现在", "b_stance": "再等等"},
        {"axis": "风险偏好", "a_stance": "高风险高回报", "b_stance": "稳健积累"}
      ],
      "debate_recommended": true
    }
  ],
  "space_stats": {
    "conflict_density": 0.63,
    "consensus_clusters": 1,
    "diversity_index": 0.71
  }
}
```

**计算逻辑**：
```python
# pairwise diversity = 1 - cosine_similarity(embedding_a, embedding_b)
# conflict_score > 0.7  →  fundamental conflict → 建议辩论
# conflict_score 0.3-0.7 → partial conflict
# conflict_score < 0.3  →  minor / consensus
```

### 4. `POST /spaces/{space_id}/debates` — 触发认知辩论

**输入**：
```json
{
  "edge_id": "edge_001",
  "format": "structured",
  "rounds": 2,
  "focus_axes": ["时机判断", "风险偏好"]
}
```

**输出**：
```json
{
  "debate_id": "debate_xyz789",
  "edge_id": "edge_001",
  "participants": ["agent_001", "agent_002"],
  "transcript": [
    {
      "round": 1,
      "turns": [
        {
          "agent": "agent_001",
          "type": "argument",
          "content": "AI应用层的窗口期约18个月...",
          "evidence": ["2024年AI融资同比下降30%"]
        },
        {
          "agent": "agent_002",
          "type": "rebuttal",
          "content": "但盲目入场失败率更高...",
          "counter_evidence": ["首次创业失败率90%"]
        }
      ]
    }
  ],
  "synthesis": {
    "core_conflict": "风险判断的时间尺度不同",
    "resolution_suggestion": "先用副业验证PMF，降低试错成本",
    "agreement_points": ["AI是长期趋势", "需要准备而非冲动"],
    "divergence_points": ["最佳入场时机", "可接受的风险水平"]
  },
  "visualization": {
    "conflict_map": {
      "nodes": [
        {"id": "时机判断", "type": "axis"},
        {"id": "风险偏好", "type": "axis"}
      ],
      "edges": [
        {"source": "agent_001", "target": "时机判断", "polarity": "early"},
        {"source": "agent_002", "target": "时机判断", "polarity": "later"}
      ]
    }
  }
}
```

### 5. `GET /spaces/{space_id}/trajectory` — 获取用户认知轨迹

**输出**：
```json
{
  "trajectory_id": "traj_001",
  "space_id": "space_abc123",
  "path": [
    {"node": "agent_001", "timestamp": 0, "action": "view", "dwell_time": 8},
    {"node": "agent_003", "timestamp": 12, "action": "expand", "dwell_time": 15},
    {"node": "edge_001", "timestamp": 32, "action": "debate", "dwell_time": 45},
    {"node": "agent_002", "timestamp": 82, "action": "view", "dwell_time": 12}
  ],
  "cognitive_metrics": {
    "coverage_area": 0.47,
    "depth_score": 0.73,
    "breadth_score": 0.65,
    "conflict_engagement": 0.84
  },
  "journey_stage": "conflict_resolution",
  "suggested_next": {
    "action": "view_synthesis",
    "reason": "你已经看过冲突双方，建议查看共识总结"
  }
}
```

### 6. `POST /spaces/{space_id}/export` — 导出认知路径

**输入**：
```json
{
  "format": "shareable_card",
  "include_trajectory": true,
  "include_synthesis": true
}
```

**输出**：
```json
{
  "export_id": "export_001",
  "share_url": "https://cognitive.space/s/abc123",
  "card_preview": {
    "title": "我的认知探索：离职创业？",
    "summary": "探索了3个视角，参与了1场辩论，认知扩展指数 +47%",
    "space_snapshot": {
      "agents_count": 3,
      "debates_count": 1,
      "coverage_area": 0.47
    }
  }
}
```

## 前端可视化映射

| API 数据 | 前端呈现 |
|---------|---------|
| `agents[].position` | 散点图/力导向图中的节点 |
| `edges[].conflict_score` | 节点之间的连线（粗细=冲突强度，颜色=冲突类型）|
| `trajectory.path` | 用户探索路径（动画轨迹）|
| `cognitive_metrics.coverage_area` | 轨迹包围的面积（认知扩展指数可视化）|
| `synthesis.conflict_map` | 分歧轴的可视化图谱 |
