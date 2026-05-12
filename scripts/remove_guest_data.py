#!/usr/bin/env python3
"""Remove all guest-related data from the database.

This script deletes every space (and its cascading agents, edges, debates,
trajectories, trajectory_events) where guest_id is set.
Guest mode has been disabled; this cleans up historical guest data.
"""

import os
import sys

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.shared.db_config import USE_DB, get_db_session, DB_SCHEMA_CORE

if not USE_DB:
    print("Database mode is disabled (USE_DB=false). Nothing to clean.")
    sys.exit(0)

from sqlalchemy import text
from services.core.models_db import SpaceDB, AgentDB, EdgeDB, DebateDB, TrajectoryDB, TrajectoryEventDB


def delete_guest_spaces() -> int:
    session_gen = get_db_session()
    session = next(session_gen)
    deleted_count = 0
    try:
        # Find all guest spaces
        guest_spaces = session.query(SpaceDB).filter(SpaceDB.guest_id.isnot(None)).all()
        if not guest_spaces:
            print("No guest spaces found.")
            return 0

        print(f"Found {len(guest_spaces)} guest space(s) to delete.")

        # Disable trigger that conflicts with cascade deletes
        from sqlalchemy import text
        session.execute(text("ALTER TABLE core.agents DISABLE TRIGGER agents_before_delete"))

        for space in guest_spaces:
            space_id = space.space_id
            print(f"  Deleting space {space_id} ...")

            # 1. trajectory_events (depend on trajectories)
            traj_ids = [
                t.trajectory_id
                for t in session.query(TrajectoryDB).filter_by(space_id=space_id).all()
            ]
            if traj_ids:
                session.query(TrajectoryEventDB).filter(
                    TrajectoryEventDB.trajectory_id.in_(traj_ids)
                ).delete(synchronize_session=False)

            # 2. trajectories
            session.query(TrajectoryDB).filter_by(space_id=space_id).delete(synchronize_session=False)

            # 3. debates
            session.query(DebateDB).filter_by(space_id=space_id).delete(synchronize_session=False)

            # 4. edges
            session.query(EdgeDB).filter_by(space_id=space_id).delete(synchronize_session=False)

            # 5. agents
            session.query(AgentDB).filter_by(space_id=space_id).delete(synchronize_session=False)

            # 6. space (root row)
            session.delete(space)
            deleted_count += 1

        # Re-enable trigger
        session.execute(text("ALTER TABLE core.agents ENABLE TRIGGER agents_before_delete"))

        session.commit()
        print(f"Successfully deleted {deleted_count} guest space(s).")
        return deleted_count
    except Exception as e:
        session.rollback()
        # Ensure trigger is re-enabled even on failure
        try:
            session.execute(text("ALTER TABLE core.agents ENABLE TRIGGER agents_before_delete"))
            session.commit()
        except Exception:
            pass
        print(f"Error during cleanup: {e}")
        raise
    finally:
        try:
            next(session_gen, None)
        except StopIteration:
            pass


if __name__ == "__main__":
    delete_guest_spaces()
