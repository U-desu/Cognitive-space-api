"""PostgreSQL store for Core Service.

Implements the same interface as memory_store.py but persists to PostgreSQL.
"""

from typing import Optional

from services.shared.db_config import get_db_session
from services.shared.models import Space, Edge, Debate, Trajectory, TrajectoryPoint, User
from services.core.models_db import (
    SpaceDB, AgentDB, EdgeDB, DebateDB, TrajectoryDB, TrajectoryEventDB,
)


# ── Helpers ──

def _space_to_db(space: Space) -> SpaceDB:
    # Convert Dimension objects to plain dicts for JSON serialization
    dims = {}
    for k, v in (space.dimensions or {}).items():
        if hasattr(v, "model_dump"):
            dims[k] = v.model_dump()
        elif isinstance(v, dict):
            dims[k] = v
        else:
            dims[k] = {"name": getattr(v, "name", ""), "label": getattr(v, "label", ""), "range": getattr(v, "range", [0.0, 1.0])}
    return SpaceDB(
        space_id=space.space_id,
        query=space.query,
        dimensions=dims,
        metadata_=space.metadata.model_dump() if space.metadata else {},
        user_id=space.user_id,
        guest_id=space.guest_id,
        query_embedding=space.query_embedding,
    )


def _space_from_db(row: SpaceDB) -> Space:
    from services.shared.models import SpaceMetadata, Dimension
    dims = {
        k: Dimension(**v) if isinstance(v, dict) else v
        for k, v in (row.dimensions or {}).items()
    }
    return Space(
        space_id=row.space_id,
        query=row.query,
        dimensions=dims,
        agents=[],
        metadata=SpaceMetadata(**(row.metadata_ or {})),
        user_id=row.user_id,
        guest_id=row.guest_id,
        query_embedding=row.query_embedding,
    )


def _agent_from_db(row: AgentDB) -> "Agent":
    from services.shared.models import Agent, Position, Stance
    return Agent(
        agent_id=row.agent_id,
        name=row.name,
        persona=row.persona or "",
        position=Position(authority=row.authority or 0.0, novelty=row.novelty or 0.0),
        stance=Stance(row.stance) if row.stance else Stance.NEUTRAL,
        confidence=row.confidence or 0.8,
        domain=row.domain or "",
        summary=row.summary or "",
        parent_id=row.parent_id,
    )


def _edge_from_db(row: EdgeDB) -> Edge:
    from services.shared.models import DivergenceAxis
    div_axes = []
    if row.divergence_axes:
        for d in row.divergence_axes:
            if isinstance(d, dict):
                div_axes.append(DivergenceAxis(**d))
            else:
                div_axes.append(d)
    return Edge(
        edge_id=row.edge_id,
        source=row.source_agent_id,
        target=row.target_agent_id,
        conflict_score=row.conflict_score,
        conflict_type=row.conflict_type or "partial",
        shared_ground=list(row.shared_ground or []),
        divergence_axes=div_axes,
        debate_recommended=row.debate_recommended or False,
    )


def _debate_from_db(row: DebateDB) -> Debate:
    from services.shared.models import DebateRound, DebateTurn, Synthesis
    return Debate(
        debate_id=row.debate_id,
        edge_id=row.edge_id,
        participants=list(row.participants or []),
        transcript=[
            DebateRound(
                round=r.get("round", 0),
                turns=[DebateTurn(**t) for t in r.get("turns", [])],
            )
            for r in (row.transcript or [])
        ],
        synthesis=Synthesis(**(row.synthesis or {})),
        visualization={},
    )


def _trajectory_from_db(row: TrajectoryDB) -> Trajectory:
    from services.shared.models import TrajectoryPoint
    return Trajectory(
        trajectory_id=row.trajectory_id,
        space_id=row.space_id,
        path=[TrajectoryPoint(**p) for p in (row.path or [])],
        cognitive_metrics=row.cognitive_metrics or {},
        journey_stage=row.journey_stage or "exploration",
        suggested_next=row.suggested_next or {},
    )


# ── Space ──

def save_space(space: Space) -> None:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        existing = session.query(SpaceDB).filter_by(space_id=space.space_id).first()
        if existing:
            existing.query = space.query
            # Convert Dimension objects to plain dicts for JSON serialization
            dims = {}
            for k, v in (space.dimensions or {}).items():
                if hasattr(v, "model_dump"):
                    dims[k] = v.model_dump()
                elif isinstance(v, dict):
                    dims[k] = v
                else:
                    dims[k] = {"name": getattr(v, "name", ""), "label": getattr(v, "label", ""), "range": getattr(v, "range", [0.0, 1.0])}
            existing.dimensions = dims
            existing.metadata_ = space.metadata.model_dump() if space.metadata else {}
            existing.user_id = space.user_id
        else:
            session.add(_space_to_db(space))
        # Upsert agents
        for agent in space.agents:
            agent_row = session.query(AgentDB).filter_by(
                space_id=space.space_id, agent_id=agent.agent_id
            ).first()
            pos = agent.position
            data = {
                "name": agent.name,
                "persona": agent.persona,
                "domain": agent.domain,
                "summary": agent.summary,
                "stance": agent.stance,
                "confidence": agent.confidence,
                "authority": pos.authority,
                "novelty": pos.novelty,
                "parent_id": agent.parent_id,
            }
            if agent_row:
                for k, v in data.items():
                    setattr(agent_row, k, v)
            else:
                session.add(AgentDB(space_id=space.space_id, agent_id=agent.agent_id, **data))
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def get_space(space_id: str) -> Optional[Space]:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        row = session.query(SpaceDB).filter_by(space_id=space_id).first()
        if not row:
            return None
        space = _space_from_db(row)
        agents = session.query(AgentDB).filter_by(space_id=space_id).all()
        space.agents = [_agent_from_db(a) for a in agents]
        return space
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def get_user_spaces(user_id: str) -> list[str]:
    """Get space IDs linked to a user (via user_id on spaces table)."""
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        rows = session.query(SpaceDB.space_id).filter_by(user_id=user_id).all()
        return [r.space_id for r in rows]
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def add_agents_to_space(space_id: str, agents: list["Agent"]) -> None:
    """Append new agents to an existing space (used by expand)."""
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        existing_ids = {
            r.agent_id for r in
            session.query(AgentDB).filter_by(space_id=space_id).all()
        }
        for agent in agents:
            if agent.agent_id in existing_ids:
                continue
            pos = agent.position
            session.add(AgentDB(
                space_id=space_id,
                agent_id=agent.agent_id,
                name=agent.name,
                persona=agent.persona,
                domain=agent.domain,
                summary=agent.summary,
                stance=agent.stance.value if isinstance(agent.stance, Enum) else agent.stance,
                confidence=agent.confidence,
                authority=pos.authority,
                novelty=pos.novelty,
                parent_id=agent.parent_id,
            ))
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def list_spaces() -> list[Space]:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        rows = session.query(SpaceDB).all()
        spaces = []
        for row in rows:
            space = _space_from_db(row)
            agents = session.query(AgentDB).filter_by(space_id=row.space_id).all()
            space.agents = [_agent_from_db(a) for a in agents]
            spaces.append(space)
        return spaces
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def find_similar_space(owner_id: str, query_embedding: list[float], threshold: float = 0.85) -> Optional[Space]:
    """Find the most similar space for the given owner."""
    import math
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        from sqlalchemy import or_
        rows = session.query(SpaceDB).filter(
            or_(SpaceDB.user_id == owner_id, SpaceDB.guest_id == owner_id)
        ).filter(SpaceDB.query_embedding.isnot(None)).all()
        best_space = None
        best_score = 0.0
        for row in rows:
            emb = row.query_embedding
            if not emb:
                continue
            dot = sum(a * b for a, b in zip(query_embedding, emb))
            norm_a = math.sqrt(sum(x * x for x in query_embedding))
            norm_b = math.sqrt(sum(x * x for x in emb))
            if norm_a == 0 or norm_b == 0:
                continue
            score = dot / (norm_a * norm_b)
            if score > best_score:
                best_score = score
                best_space = row
        if best_space and best_score >= threshold:
            space = _space_from_db(best_space)
            agents = session.query(AgentDB).filter_by(space_id=best_space.space_id).all()
            space.agents = [_agent_from_db(a) for a in agents]
            return space
        return None
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def list_space_history(owner_id: str) -> list[Space]:
    """List all spaces for the given owner (user or guest), ordered by creation time desc."""
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        from sqlalchemy import or_
        rows = session.query(SpaceDB).filter(
            or_(SpaceDB.user_id == owner_id, SpaceDB.guest_id == owner_id)
        ).order_by(SpaceDB.created_at.desc()).all()
        spaces = []
        for row in rows:
            space = _space_from_db(row)
            agents = session.query(AgentDB).filter_by(space_id=row.space_id).all()
            space.agents = [_agent_from_db(a) for a in agents]
            spaces.append(space)
        return spaces
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def delete_space(space_id: str) -> bool:
    """Delete a space and all its related data (agents, edges, debates, trajectories).
    
    Relies on DB-level ON DELETE CASCADE for related tables.
    """
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        row = session.query(SpaceDB).filter_by(space_id=space_id).first()
        if not row:
            return False
        session.delete(row)
        session.commit()
        return True
    except Exception:
        session.rollback()
        raise
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


# ── Edge ──

def save_edges(space_id: str, edges: list[Edge]) -> None:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        for edge in edges:
            row = session.query(EdgeDB).filter_by(space_id=space_id, edge_id=edge.edge_id).first()
            div_axes = [d.model_dump() for d in edge.divergence_axes] if edge.divergence_axes else []
            data = {
                "source_agent_id": edge.source,
                "target_agent_id": edge.target,
                "conflict_score": edge.conflict_score,
                "conflict_type": edge.conflict_type,
                "shared_ground": edge.shared_ground,
                "divergence_axes": div_axes,
                "debate_recommended": edge.debate_recommended,
            }
            if row:
                for k, v in data.items():
                    setattr(row, k, v)
            else:
                session.add(EdgeDB(space_id=space_id, edge_id=edge.edge_id, **data))
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def get_edges(space_id: str) -> list[Edge]:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        rows = session.query(EdgeDB).filter_by(space_id=space_id).all()
        return [_edge_from_db(r) for r in rows]
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def get_edge(space_id: str, edge_id: str) -> Optional[Edge]:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        row = session.query(EdgeDB).filter_by(space_id=space_id, edge_id=edge_id).first()
        return _edge_from_db(row) if row else None
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def update_edge(space_id: str, edge: Edge) -> None:
    save_edges(space_id, [edge])


# ── Debate ──

def save_debate(debate: Debate) -> None:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        row = session.query(DebateDB).filter_by(debate_id=debate.debate_id).first()
        transcript = []
        for r in debate.transcript:
            rd = r.model_dump()
            rd["turns"] = [t.model_dump() for t in r.turns]
            transcript.append(rd)
        data = {
            "space_id": debate.space_id,
            "edge_id": debate.edge_id,
            "participants": debate.participants,
            "transcript": transcript,
            "synthesis": debate.synthesis.model_dump(),
        }
        if row:
            for k, v in data.items():
                setattr(row, k, v)
        else:
            session.add(DebateDB(debate_id=debate.debate_id, **data))
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def get_debate(debate_id: str) -> Optional[Debate]:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        row = session.query(DebateDB).filter_by(debate_id=debate_id).first()
        return _debate_from_db(row) if row else None
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def get_debates_by_edge(edge_id: str) -> list[Debate]:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        rows = session.query(DebateDB).filter_by(edge_id=edge_id).all()
        return [_debate_from_db(r) for r in rows]
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


# ── Trajectory ──

def get_or_create_trajectory(space_id: str) -> Trajectory:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        row = session.query(TrajectoryDB).filter_by(space_id=space_id).first()
        if row:
            return _trajectory_from_db(row)
        traj = Trajectory(
            trajectory_id=f"traj_{space_id}",
            space_id=space_id,
            path=[],
            cognitive_metrics={
                "coverage_area": 0.18,
                "depth_score": 0.12,
                "breadth_score": 0.25,
                "conflict_engagement": 0.10,
            },
            journey_stage="exploration",
            suggested_next={"action": "view_agent", "reason": "开始探索不同专家视角"},
        )
        session.add(TrajectoryDB(
            trajectory_id=traj.trajectory_id,
            space_id=space_id,
            path=[],
            cognitive_metrics=traj.cognitive_metrics,
            journey_stage=traj.journey_stage,
            suggested_next=traj.suggested_next,
        ))
        session.commit()
        return traj
    except Exception:
        session.rollback()
        raise
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


def save_trajectory(trajectory: Trajectory) -> None:
    session_gen = get_db_session()
    session = next(session_gen)
    try:
        row = session.query(TrajectoryDB).filter_by(space_id=trajectory.space_id).first()
        path = [p.model_dump() for p in trajectory.path]
        data = {
            "path": path,
            "cognitive_metrics": trajectory.cognitive_metrics,
            "journey_stage": trajectory.journey_stage,
            "suggested_next": trajectory.suggested_next,
        }
        if row:
            for k, v in data.items():
                setattr(row, k, v)
        else:
            session.add(TrajectoryDB(
                trajectory_id=trajectory.trajectory_id,
                space_id=trajectory.space_id,
                **data,
            ))
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


# ── User / Auth (mirrors memory_store for backward compat) ──

