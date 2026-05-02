# Cognitive Space API

融合"认知空间"概念的多智能体辩论与认知扩展系统。

> 传统系统试图消除分歧，而我们把分歧建模成空间结构。

## 核心概念

- **Agent（认知节点）**：每个专家视角是一个坐标点 `(authority, novelty)`
- **Edge（冲突边）**：基于 pairwise diversity 的语义距离
- **Trajectory（认知轨迹）**：用户在空间中的探索路径
- **认知扩展指数**：轨迹覆盖面积

## 文档

- [`docs/api-design.md`](docs/api-design.md) — API 完整设计
- [`docs/pitch-script.md`](docs/pitch-script.md) — 5分钟答辩逐句稿

## 快速开始

```bash
# 创建认知空间
POST /spaces
{
  "query": "我是否应该从大厂离职去做AI创业？"
}

# 计算冲突边
POST /spaces/{space_id}/edges

# 触发辩论
POST /spaces/{space_id}/debates

# 获取认知轨迹
GET /spaces/{space_id}/trajectory
```
