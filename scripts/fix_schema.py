#!/usr/bin/env python3
"""
修复数据库 schema 约束，确保数据完整性和级联删除。

Usage:
    python3 scripts/fix_schema.py

修复内容：
    1. edges FK → ON DELETE CASCADE（删除 agent 时自动清理关联 edges）
    2. agents.parent_id → self-referencing FK（ON DELETE SET NULL）
    3. spaces.user_id → FK to auth.users（ON DELETE SET NULL）
    4. debates.edge_id → FK to core.edges（ON DELETE CASCADE）
    5. auth.user_spaces.space_id → FK to core.spaces（ON DELETE CASCADE）
    6. auth.user_spaces(user_id, space_id) → UNIQUE 约束
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from services.shared.db_config import engine, USE_DB


def fix_schema():
    if not USE_DB:
        print("USE_DB=false，跳过 schema 修复")
        return

    if engine is None:
        print("ERROR: Database engine not initialized.")
        sys.exit(1)

    print("开始修复数据库约束...")

    with engine.connect() as conn:
        with conn.begin():
            # 1. edges: 重建 composite FK 为 ON DELETE CASCADE
            print("  1. 修复 edges composite FK → CASCADE")
            conn.execute(text("""
                ALTER TABLE core.edges
                DROP CONSTRAINT IF EXISTS edges_space_id_source_agent_id_fkey;
            """))
            conn.execute(text("""
                ALTER TABLE core.edges
                ADD CONSTRAINT edges_space_id_source_agent_id_fkey
                FOREIGN KEY (space_id, source_agent_id)
                REFERENCES core.agents(space_id, agent_id)
                ON DELETE CASCADE;
            """))
            conn.execute(text("""
                ALTER TABLE core.edges
                DROP CONSTRAINT IF EXISTS edges_space_id_target_agent_id_fkey;
            """))
            conn.execute(text("""
                ALTER TABLE core.edges
                ADD CONSTRAINT edges_space_id_target_agent_id_fkey
                FOREIGN KEY (space_id, target_agent_id)
                REFERENCES core.agents(space_id, agent_id)
                ON DELETE CASCADE;
            """))

            # 2. agents.parent_id → self-referencing FK
            print("  2. 添加 agents.parent_id self-referencing FK")
            conn.execute(text("""
                ALTER TABLE core.agents
                DROP CONSTRAINT IF EXISTS agents_parent_id_fkey;
            """))
            conn.execute(text("""
                ALTER TABLE core.agents
                ADD CONSTRAINT agents_parent_id_fkey
                FOREIGN KEY (space_id, parent_id)
                REFERENCES core.agents(space_id, agent_id)
                ON DELETE SET NULL;
            """))

            # 3. spaces.user_id → FK to auth.users
            print("  3. 添加 spaces.user_id FK")
            conn.execute(text("""
                ALTER TABLE core.spaces
                DROP CONSTRAINT IF EXISTS spaces_user_id_fkey;
            """))
            conn.execute(text("""
                ALTER TABLE core.spaces
                ADD CONSTRAINT spaces_user_id_fkey
                FOREIGN KEY (user_id)
                REFERENCES auth.users(user_id)
                ON DELETE SET NULL;
            """))

            # 4. debates.edge_id → FK to core.edges
            print("  4. 添加 debates.edge_id FK")
            conn.execute(text("""
                ALTER TABLE core.debates
                DROP CONSTRAINT IF EXISTS debates_edge_id_fkey;
            """))
            conn.execute(text("""
                ALTER TABLE core.debates
                ADD CONSTRAINT debates_edge_id_fkey
                FOREIGN KEY (space_id, edge_id)
                REFERENCES core.edges(space_id, edge_id)
                ON DELETE CASCADE;
            """))

            # 5. auth.user_spaces.space_id → FK to core.spaces
            print("  5. 添加 auth.user_spaces.space_id FK")
            conn.execute(text("""
                ALTER TABLE auth.user_spaces
                DROP CONSTRAINT IF EXISTS user_spaces_space_id_fkey;
            """))
            conn.execute(text("""
                ALTER TABLE auth.user_spaces
                ADD CONSTRAINT user_spaces_space_id_fkey
                FOREIGN KEY (space_id)
                REFERENCES core.spaces(space_id)
                ON DELETE CASCADE;
            """))

            # 6. auth.user_spaces(user_id, space_id) UNIQUE
            print("  6. 添加 auth.user_spaces UNIQUE 约束")
            conn.execute(text("""
                ALTER TABLE auth.user_spaces
                DROP CONSTRAINT IF EXISTS user_spaces_user_space_unique;
            """))
            conn.execute(text("""
                ALTER TABLE auth.user_spaces
                ADD CONSTRAINT user_spaces_user_space_unique
                UNIQUE (user_id, space_id);
            """))

            # 7. core.user_spaces(user_id, space_id) UNIQUE（冗余表，Phase 1.4 会删表，先加约束保持一致）
            print("  7. 添加 core.user_spaces UNIQUE 约束（冗余表）")
            conn.execute(text("""
                ALTER TABLE core.user_spaces
                DROP CONSTRAINT IF EXISTS core_user_spaces_user_space_unique;
            """))
            conn.execute(text("""
                ALTER TABLE core.user_spaces
                ADD CONSTRAINT core_user_spaces_user_space_unique
                UNIQUE (user_id, space_id);
            """))

    print("\nSchema 约束修复完成。")


if __name__ == "__main__":
    fix_schema()
