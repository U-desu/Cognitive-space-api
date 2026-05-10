"""add guest_id and query_embedding to spaces

Revision ID: 5f1153b6edc8
Revises: b6b0dee3aad3
Create Date: 2026-05-10 21:32:25.076726

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5f1153b6edc8'
down_revision: Union[str, Sequence[str], None] = 'b6b0dee3aad3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add guest_id and query_embedding to spaces table."""
    op.add_column('spaces', sa.Column('guest_id', sa.String(length=64), nullable=True), schema='core')
    op.create_index('ix_spaces_guest_id', 'spaces', ['guest_id'], schema='core')
    op.add_column('spaces', sa.Column('query_embedding', sa.ARRAY(sa.Float()), nullable=True), schema='core')


def downgrade() -> None:
    """Remove guest_id and query_embedding from spaces table."""
    op.drop_column('spaces', 'query_embedding', schema='core')
    op.drop_index('ix_spaces_guest_id', table_name='spaces', schema='core')
    op.drop_column('spaces', 'guest_id', schema='core')
