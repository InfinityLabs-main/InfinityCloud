"""Security and billing fixes

- users.balance: Float → Numeric(12,2)
- transactions.amount: Float → Numeric(12,2)
- transactions.balance_after: Float → Numeric(12,2)
- transactions.billing_period: new column (String(30), indexed)
- transactions.server_id: SET NULL on delete (FK update)

Revision ID: 002_security_billing_fixes
Revises: 001_initial
Create Date: 2026-04-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002_security_billing_fixes"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users.balance: Float → Numeric(12,2) ─────────
    op.alter_column(
        "users",
        "balance",
        type_=sa.Numeric(12, 2),
        existing_type=sa.Float(),
        server_default="0.00",
        postgresql_using="balance::numeric(12,2)",
    )

    # ── transactions.amount: Float → Numeric(12,2) ───
    op.alter_column(
        "transactions",
        "amount",
        type_=sa.Numeric(12, 2),
        existing_type=sa.Float(),
        postgresql_using="amount::numeric(12,2)",
    )

    # ── transactions.balance_after: Float → Numeric(12,2)
    op.alter_column(
        "transactions",
        "balance_after",
        type_=sa.Numeric(12, 2),
        existing_type=sa.Float(),
        postgresql_using="balance_after::numeric(12,2)",
    )

    # ── transactions.billing_period: new column ──────
    op.add_column(
        "transactions",
        sa.Column("billing_period", sa.String(30), nullable=True),
    )
    op.create_index(
        "ix_transactions_billing_period",
        "transactions",
        ["billing_period"],
    )

    # ── transactions.server_id FK: add ON DELETE SET NULL
    # Drop old FK, recreate with ondelete
    op.drop_constraint(
        "transactions_server_id_fkey",
        "transactions",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "transactions_server_id_fkey",
        "transactions",
        "servers",
        ["server_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    # Revert FK
    op.drop_constraint("transactions_server_id_fkey", "transactions", type_="foreignkey")
    op.create_foreign_key(
        "transactions_server_id_fkey",
        "transactions",
        "servers",
        ["server_id"],
        ["id"],
    )

    # Drop billing_period
    op.drop_index("ix_transactions_billing_period", "transactions")
    op.drop_column("transactions", "billing_period")

    # Revert Numeric → Float
    op.alter_column("transactions", "balance_after", type_=sa.Float(), existing_type=sa.Numeric(12, 2))
    op.alter_column("transactions", "amount", type_=sa.Float(), existing_type=sa.Numeric(12, 2))
    op.alter_column("users", "balance", type_=sa.Float(), existing_type=sa.Numeric(12, 2), server_default="0")
