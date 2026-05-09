#!/usr/bin/env python3
"""
安全清理所有业务数据和用户数据。
保留表结构，只删除数据。

Usage:
    python3 scripts/clean_data.py [--confirm]

注意：
    - core schema 下的 spaces/agents/edges/debates/trajectories/trajectory_events 会被清空
    - auth schema 下的 users/passwords/oauth_accounts/user_spaces 会被清空
    - core schema 下的冗余 auth 表（users/passwords/oauth_accounts/user_spaces）也会被清空
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from services.shared.db_config import engine, USE_DB


def clean_database():
    if not USE_DB:
        print("USE_DB=false，无需清理数据库（内存模式）")
        return

    if engine is None:
        print("ERROR: Database engine not initialized.")
        sys.exit(1)

    print("开始清理数据库...")

    # 业务数据表（core schema）
    # 按依赖关系倒序删除，避免 FK 约束冲突
    core_tables = [
        "trajectory_events",
        "trajectories",
        "debates",
        "edges",
        "agents",
        "spaces",
    ]

    # Auth 数据表（auth schema）
    auth_tables = [
        "user_spaces",
        "oauth_accounts",
        "passwords",
        "users",
    ]

    # Core 中的冗余 auth 表（Phase 1.4 会删除这些表，但目前先清空数据）
    core_auth_tables = [
        "user_spaces",
        "oauth_accounts",
        "passwords",
        "users",
    ]

    with engine.connect() as conn:
        with conn.begin():
            # 先清理有外键依赖的表
            for table in core_tables:
                result = conn.execute(text(f"DELETE FROM core.{table}"))
                print(f"  清空 core.{table}: {result.rowcount} 行已删除")

            for table in auth_tables:
                result = conn.execute(text(f"DELETE FROM auth.{table}"))
                print(f"  清空 auth.{table}: {result.rowcount} 行已删除")

            for table in core_auth_tables:
                result = conn.execute(text(f"DELETE FROM core.{table}"))
                print(f"  清空 core.{table}: {result.rowcount} 行已删除")

    print("\n数据库清理完成。")


if __name__ == "__main__":
    if "--confirm" not in sys.argv:
        print("警告：这将删除所有业务数据和用户数据！")
        print("如果确定要执行，请运行：")
        print("    python3 scripts/clean_data.py --confirm")
        sys.exit(0)

    clean_database()
