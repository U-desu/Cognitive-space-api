"""Core Service store dispatcher.

Switches between memory and PostgreSQL backends via USE_DB env var.
All routers import from this module — no code changes needed when switching.
"""

from services.shared.db_config import USE_DB

if USE_DB:
    from services.core.db_store import (
        save_space, get_space, list_spaces, delete_space,
        add_agents_to_space, get_user_spaces,
        find_similar_space, list_space_history,
        save_edges, get_edges, get_edge, update_edge,
        save_debate, get_debate, get_debates_by_edge,
        get_or_create_trajectory, save_trajectory,
    )
else:
    from services.core.memory_store import (
        save_space, get_space, list_spaces, delete_space,
        add_agents_to_space, get_user_spaces,
        find_similar_space, list_space_history,
        save_edges, get_edges, get_edge, update_edge,
        save_debate, get_debate, get_debates_by_edge,
        get_or_create_trajectory, save_trajectory,
    )
