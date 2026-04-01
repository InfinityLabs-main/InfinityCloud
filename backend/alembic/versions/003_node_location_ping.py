"""Node location and ping tracking

Add location/country fields and ping monitoring to nodes table.

Revision ID: 003_node_location_ping
Revises: 002_security_billing_fixes
Create Date: 2026-04-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003_node_location_ping"
down_revision: Union[str, None] = "002_security_billing_fixes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("nodes", sa.Column("location", sa.String(100), nullable=True))
    op.add_column("nodes", sa.Column("country", sa.String(100), nullable=True))
    op.add_column("nodes", sa.Column("country_code", sa.String(5), nullable=True))
    op.add_column("nodes", sa.Column("ping_ms", sa.Float(), nullable=True))
    op.add_column("nodes", sa.Column("last_ping_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("nodes", "last_ping_at")
    op.drop_column("nodes", "ping_ms")
    op.drop_column("nodes", "country_code")
    op.drop_column("nodes", "country")
    op.drop_column("nodes", "location")
