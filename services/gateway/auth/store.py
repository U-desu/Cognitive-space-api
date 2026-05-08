"""Gateway auth store dispatcher.

Switches between memory and PostgreSQL backends via USE_DB env var.
"""

from services.shared.db_config import USE_DB

if USE_DB:
    from services.gateway.auth.db_store import (
        create_user, get_user, get_user_by_username, get_user_by_oauth,
        save_password, get_password_hash, link_oauth,
        link_space_to_user, get_user_spaces,
    )
else:
    from services.gateway.auth.memory_store import (
        create_user, get_user, get_user_by_username, get_user_by_oauth,
        save_password, get_password_hash, link_oauth,
        link_space_to_user, get_user_spaces,
    )
