#!/usr/bin/env python3
"""
端到端真实 LLM 演示脚本

按照 stage/system-architecture.md 的业务逻辑流，从用户输入问题开始，
每一步调用实际 API，使用真实 LLM 生成 Agent、真实 Embedding 计算 Edge。

前置条件：
    1. MOCK_LLM=false
    2. COMPUTE_EMBED_BACKEND=local（需 sentence-transformers）
    3. 所有微服务已启动（./scripts/start-services.sh）

用法：
    python3 stage/end-to-end-demo.py
    python3 stage/end-to-end-demo.py "我该辞职创业吗？"
"""

import argparse
import json
import os
import sys
import time
import uuid
from typing import Optional

import requests

# ── 配置 ──
GATEWAY = "http://localhost:8000"
TIMEOUT = 120

# 三个预设热门问题
HOT_QUESTIONS = [
    "大厂5年了，该辞职去做AI创业吗？",
    "AI发展这么快，程序员会被取代吗？",
    "30岁该继续深耕技术还是转管理？",
]

# ── 工具函数 ──

def banner(title: str):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def step(num: int, desc: str):
    print(f"\n>>> Step {num}: {desc}")


def print_json(data: dict, indent: int = 2):
    print(json.dumps(data, ensure_ascii=False, indent=indent))


# ── 去重逻辑 ──

def dedup_check(session: requests.Session, query: str, threshold: float = 0.65) -> Optional[dict]:
    """查询已有 spaces，使用 jieba + TF-IDF 计算语义相似度。"""
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        import jieba
    except ImportError:
        print("[警告] 缺少 jieba 或 scikit-learn，跳过去重")
        return None

    resp = session.get(f"{GATEWAY}/spaces", timeout=TIMEOUT)
    if resp.status_code != 200:
        return None
    spaces = resp.json()
    if not spaces:
        return None

    queries = [s.get("query", "") for s in spaces]
    if not any(queries):
        return None

    # jieba 分词 + TF-IDF
    def tokenize(text: str) -> str:
        return " ".join(jieba.cut(text))

    corpus = [tokenize(q) for q in queries + [query]]
    vectorizer = TfidfVectorizer()
    tfidf = vectorizer.fit_transform(corpus)
    vec_new = tfidf[-1]
    vec_existing = tfidf[:-1]

    from sklearn.metrics.pairwise import cosine_similarity
    sims = cosine_similarity(vec_new, vec_existing)[0]
    max_sim = float(sims.max()) if len(sims) > 0 else 0.0
    most_similar_idx = int(sims.argmax()) if len(sims) > 0 else -1

    print(f"  与历史问题最大相似度: {max_sim:.3f} (阈值: {threshold})")
    if max_sim >= threshold:
        matched = spaces[most_similar_idx]
        print(f"  -> 命中已有 Space: {matched['space_id']}")
        return matched
    return None


# ── 认证 ──

def auth_guest(session: requests.Session) -> dict:
    """使用 Guest 模式：注册一个随机用户并登录。"""
    username = f"demo_{uuid.uuid4().hex[:8]}"
    password = "demo123456"

    # 注册
    resp = session.post(
        f"{GATEWAY}/auth/register",
        json={"username": username, "password": password, "email": f"{username}@demo.com"},
        timeout=TIMEOUT,
    )
    if resp.status_code == 200:
        print(f"  注册成功: {username}")
    elif resp.status_code == 409:
        print(f"  用户已存在，直接登录: {username}")
    else:
        print(f"  注册返回 {resp.status_code}: {resp.text}")

    # 登录
    resp = session.post(
        f"{GATEWAY}/auth/login",
        json={"username": username, "password": password},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    user = resp.json()["user"]
    print(f"  登录成功: {user['username']} (id={user['user_id']})")
    return user


# ── 主链路 ──

def create_space(session: requests.Session, query: str) -> dict:
    """Step 4: 创建 Space（真实 LLM 生成 Agents）"""
    print(f"  调用 Generator (LLM_PROVIDER={os.getenv('LLM_PROVIDER', 'deepseek')}) 生成 Agents...")
    start = time.time()
    resp = session.post(
        f"{GATEWAY}/spaces",
        json={"query": query, "user_context": {}},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    space = resp.json()
    elapsed = time.time() - start
    print(f"  -> 生成完成，耗时 {elapsed:.1f}s")
    print(f"  Space ID: {space['space_id']}")
    print(f"  Agents 数量: {len(space.get('agents', []))}")
    for a in space.get("agents", []):
        print(f"    - [{a['stance']}] {a['name']} ({a['domain']}): {a['summary'][:50]}...")
    return space


def compute_edges(session: requests.Session, space_id: str) -> dict:
    """Step 5: 计算 Edge（真实 Embedding）"""
    print(f"  调用 Compute (backend={os.getenv('COMPUTE_EMBED_BACKEND', 'mock')}) 计算 Edge...")
    start = time.time()
    resp = session.post(
        f"{GATEWAY}/spaces/{space_id}/edges",
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    result = resp.json()
    elapsed = time.time() - start
    print(f"  -> 计算完成，耗时 {elapsed:.1f}s")
    edges = result.get("edges", [])
    stats = result.get("space_stats", {})
    print(f"  Edge 数量: {len(edges)}")
    print(f"  Stats: {stats}")

    # 冲突排行榜
    fundamental = [e for e in edges if e.get("conflict_type") == "fundamental"]
    partial = [e for e in edges if e.get("conflict_type") == "partial"]
    minor = [e for e in edges if e.get("conflict_type") == "minor"]
    print(f"  Fundamental: {len(fundamental)} | Partial: {len(partial)} | Minor: {len(minor)}")
    if fundamental:
        print("  推荐辩论的 Edge (fundamental):")
        for e in sorted(fundamental, key=lambda x: x["conflict_score"], reverse=True)[:3]:
            print(f"    - {e['source_agent_id']} <-> {e['target_agent_id']}: {e['conflict_score']:.3f}")
    return result


def get_trajectory(session: requests.Session, space_id: str) -> dict:
    """Step 6: 获取 Trajectory"""
    resp = session.get(
        f"{GATEWAY}/spaces/{space_id}/trajectory",
        timeout=TIMEOUT,
    )
    if resp.status_code == 404:
        print("  Trajectory 尚未创建（首次访问）")
        return {}
    resp.raise_for_status()
    traj = resp.json()
    print(f"  Journey Stage: {traj.get('journey_stage', 'N/A')}")
    metrics = traj.get("cognitive_metrics", {})
    if metrics:
        print(f"  Metrics: {metrics}")
    return traj


# ── 可选交互 ──

def run_debate(session: requests.Session, space_id: str, edge_id: str) -> dict:
    """Step 7a: 触发同步辩论（真实 LLM）"""
    print(f"  调用 Generator 生成辩论 (edge={edge_id})...")
    start = time.time()
    resp = session.post(
        f"{GATEWAY}/spaces/{space_id}/debates",
        json={"edge_id": edge_id, "format": "structured", "rounds": 2},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    debate = resp.json()
    elapsed = time.time() - start
    print(f"  -> 辩论生成完成，耗时 {elapsed:.1f}s")
    synthesis = debate.get("synthesis", {})
    print(f"  共识: {synthesis.get('agreement_points', [])}")
    print(f"  分歧: {synthesis.get('divergence_points', [])}")
    turns = debate.get("transcript", {}).get("turns", [])
    print(f"  轮数: {len(turns)}")
    for t in turns:
        print(f"    [{t.get('agent_id', '?')}]: {t.get('content', '')[:60]}...")
    return debate


def run_debate_stream(session: requests.Session, space_id: str, edge_id: str):
    """Step 7b: 流式辩论（真实 LLM，逐行输出）"""
    print(f"  调用 Generator 流式生成辩论 (edge={edge_id})...")
    print("  --- 开始流式输出 ---")
    resp = session.post(
        f"{GATEWAY}/spaces/{space_id}/debates/stream",
        json={"edge_id": edge_id, "format": "structured", "rounds": 2},
        timeout=TIMEOUT,
        stream=True,
    )
    resp.raise_for_status()
    for line in resp.iter_lines():
        if not line:
            continue
        text = line.decode("utf-8")
        if text.startswith("data:"):
            data = text[5:].strip()
            if data == "[DONE]":
                break
            try:
                payload = json.loads(data)
                if payload.get("type") == "turn":
                    agent = payload.get("agent_id", "?")
                    content = payload.get("content", "")[:80]
                    print(f"    [{agent}]: {content}...")
                elif payload.get("type") == "synthesis":
                    print(f"    [SYNTHESIS]: {payload.get('content', '')[:100]}...")
            except json.JSONDecodeError:
                pass
    print("  --- 流式输出结束 ---")


def expand_agent(session: requests.Session, space_id: str, agent_id: str, query_hint: str) -> dict:
    """Step 7c: Expand Agent（真实 LLM 生成子节点）"""
    print(f"  调用 Generator 扩展 Agent {agent_id} (hint={query_hint})...")
    start = time.time()
    resp = session.post(
        f"{GATEWAY}/spaces/{space_id}/agents/{agent_id}/expand",
        json={"query_hint": query_hint, "num_agents": 2},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    space = resp.json()
    elapsed = time.time() - start
    print(f"  -> 扩展完成，耗时 {elapsed:.1f}s")
    agents = space.get("agents", [])
    children = [a for a in agents if a.get("parent_id") == agent_id]
    print(f"  新增子节点: {len(children)}")
    for c in children:
        print(f"    - [{c['stance']}] {c['name']}: {c['summary'][:50]}...")
    return space


# ── 汇总输出 ──

def save_summary(space: dict, edges: dict, trajectory: dict, filename: str):
    summary = {
        "space_id": space.get("space_id"),
        "query": space.get("query"),
        "agent_count": len(space.get("agents", [])),
        "agents": [
            {
                "agent_id": a["agent_id"],
                "name": a["name"],
                "stance": a["stance"],
                "domain": a["domain"],
                "summary": a["summary"],
                "parent_id": a.get("parent_id"),
            }
            for a in space.get("agents", [])
        ],
        "edge_count": len(edges.get("edges", [])),
        "edges": edges.get("edges", []),
        "space_stats": edges.get("space_stats", {}),
        "trajectory": trajectory,
    }
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"\n  汇总已保存: {filename}")


# ── 主函数 ──

def main():
    parser = argparse.ArgumentParser(description="端到端真实 LLM 演示")
    parser.add_argument("query", nargs="?", help="用户问题（留空则交互式输入）")
    args = parser.parse_args()

    banner("认知空间 — 端到端真实 LLM 演示")

    # Step 0: 环境检查
    step(0, "环境检查")
    mock_llm = os.getenv("MOCK_LLM", "false").lower()
    embed_backend = os.getenv("COMPUTE_EMBED_BACKEND", "mock")
    print(f"  MOCK_LLM={mock_llm}")
    print(f"  COMPUTE_EMBED_BACKEND={embed_backend}")
    print(f"  LLM_PROVIDER={os.getenv('LLM_PROVIDER', 'deepseek')}")

    if mock_llm == "true":
        print("\n[错误] MOCK_LLM=true，Agent 将使用预设 mock 数据而非真实 LLM。请设置为 false 后重试。")
        sys.exit(1)
    if embed_backend == "mock":
        print("\n[警告] COMPUTE_EMBED_BACKEND=mock，Edge 计算使用非语义关键词向量。建议设置为 local 或 openai。")
        print("  继续执行...")

    try:
        r = requests.get(f"{GATEWAY}/health", timeout=5)
        r.raise_for_status()
        print(f"  Gateway 健康: {r.json()}")
    except Exception as e:
        print(f"\n[错误] Gateway 不可达: {e}")
        print("  请确保 ./scripts/start-services.sh 已启动")
        sys.exit(1)

    # Step 1: 用户输入
    step(1, "用户输入")
    query = args.query
    if not query:
        print("  请选择或输入问题：")
        for i, q in enumerate(HOT_QUESTIONS, 1):
            print(f"    {i}. {q}")
        print("    0. 自定义输入")
        choice = input("  输入编号: ").strip()
        if choice in ("1", "2", "3"):
            query = HOT_QUESTIONS[int(choice) - 1]
        else:
            query = input("  请输入你的问题: ").strip()
    print(f"  -> Query: {query}")

    # 创建 session（保持 Cookie）
    session = requests.Session()

    # Step 2: 认证
    step(2, "认证（Guest 模式）")
    user = auth_guest(session)

    # Step 3: 问题去重
    step(3, "问题去重")
    existing = dedup_check(session, query)
    if existing:
        print("  发现已有相似 Space，直接复用")
        space = existing
    else:
        print("  未命中历史问题，继续生成")

        # Step 4: 创建 Space
        step(4, "创建 Space — 真实 LLM 生成 Agents")
        space = create_space(session, query)

    space_id = space["space_id"]

    # Step 5: 计算 Edge
    step(5, "计算 Edge — 真实 Embedding")
    edges_result = compute_edges(session, space_id)

    # Step 6: 获取 Trajectory
    step(6, "获取 Trajectory")
    trajectory = get_trajectory(session, space_id)

    # Step 7: 可选交互
    step(7, "可选交互")
    edges = edges_result.get("edges", [])
    fundamental_edges = [e for e in edges if e.get("conflict_type") == "fundamental"]

    if fundamental_edges:
        top_edge = max(fundamental_edges, key=lambda x: x["conflict_score"])
        print(f"  推荐辩论 Edge: {top_edge['source_agent_id']} vs {top_edge['target_agent_id']}")
        print("\n  可选操作:")
        print("    a. 同步辩论（完整生成后输出）")
        print("    b. 流式辩论（实时逐字输出）")
        print("    c. Expand Agent（扩展某个 Agent）")
        print("    s. 保存并结束")
        choice = input("  选择: ").strip().lower()

        if choice == "a":
            run_debate(session, space_id, top_edge["edge_id"])
        elif choice == "b":
            run_debate_stream(session, space_id, top_edge["edge_id"])
        elif choice == "c":
            agent_ids = [a["agent_id"] for a in space.get("agents", [])]
            print(f"  可用 Agents: {agent_ids}")
            aid = input("  输入 agent_id: ").strip()
            hint = input("  输入 expand hint: ").strip()
            expand_agent(session, space_id, aid, hint)
    else:
        print("  无 fundamental 冲突，跳过辩论选项")

    # Step 8: 汇总
    step(8, "汇总输出")
    out_file = f"stage/output-{space_id}.json"
    save_summary(space, edges_result, trajectory, out_file)

    banner("演示完成")
    print(f"Space ID: {space_id}")
    print(f"输出文件: {out_file}")


if __name__ == "__main__":
    main()
