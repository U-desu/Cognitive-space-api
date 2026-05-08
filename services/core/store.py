"""Core Service store dispatcher.

Switches between memory and PostgreSQL backends via USE_DB env var.
All routers import from this module — no code changes needed when switching.
"""

from services.shared.db_config import USE_DB

if USE_DB:
    from services.core.db_store import (
        save_space, get_space, list_spaces,
        save_edges, get_edges, get_edge, update_edge,
        save_debate, get_debate, get_debates_by_edge,
        get_or_create_trajectory, save_trajectory,
        create_user, get_user, get_user_by_username, get_user_by_oauth,
        save_password, get_password_hash, link_oauth,
        link_space_to_user, get_user_spaces,
    )
else:
    from services.core.memory_store import (
        save_space, get_space, list_spaces,
        save_edges, get_edges, get_edge, update_edge,
        save_debate, get_debate, get_debates_by_edge,
        get_or_create_trajectory, save_trajectory,
        create_user, get_user, get_user_by_username, get_user_by_oauth,
        save_password, get_password_hash, link_oauth,
        link_space_to_user, get_user_spaces,
    )
