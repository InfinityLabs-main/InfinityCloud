"""Initial migration — все таблицы Infinity Cloud

Revision ID: 001_initial
Revises: None
Create Date: 2026-03-31
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users ─────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="user"),
        sa.Column("balance", sa.Float(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── plans ─────────────────────────────────────
    op.create_table(
        "plans",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(50), unique=True, nullable=False),
        sa.Column("cpu_cores", sa.Integer(), nullable=False),
        sa.Column("ram_mb", sa.Integer(), nullable=False),
        sa.Column("disk_gb", sa.Integer(), nullable=False),
        sa.Column("bandwidth_tb", sa.Float(), server_default="1.0"),
        sa.Column("price_per_hour", sa.Float(), nullable=False),
        sa.Column("price_per_month", sa.Float(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── nodes ─────────────────────────────────────
    op.create_table(
        "nodes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("hostname", sa.String(255), nullable=False),
        sa.Column("port", sa.Integer(), server_default="8006"),
        sa.Column("api_user", sa.String(100), nullable=False),
        sa.Column("api_token_name", sa.String(100), nullable=False),
        sa.Column("api_token_value", sa.String(255), nullable=False),
        sa.Column("total_cpu", sa.Integer(), server_default="0"),
        sa.Column("total_ram_mb", sa.Integer(), server_default="0"),
        sa.Column("total_disk_gb", sa.Integer(), server_default="0"),
        sa.Column("used_cpu", sa.Integer(), server_default="0"),
        sa.Column("used_ram_mb", sa.Integer(), server_default="0"),
        sa.Column("used_disk_gb", sa.Integer(), server_default="0"),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("max_vms", sa.Integer(), server_default="100"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── ip_addresses ──────────────────────────────
    op.create_table(
        "ip_addresses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("node_id", sa.Integer(), sa.ForeignKey("nodes.id"), nullable=False),
        sa.Column("address", sa.String(45), unique=True, nullable=False),
        sa.Column("subnet", sa.String(50), nullable=True),
        sa.Column("gateway", sa.String(45), nullable=True),
        sa.Column("is_allocated", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("rdns", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── servers ───────────────────────────────────
    op.create_table(
        "servers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("node_id", sa.Integer(), sa.ForeignKey("nodes.id"), nullable=True),
        sa.Column("ip_id", sa.Integer(), sa.ForeignKey("ip_addresses.id"), nullable=True),
        sa.Column("proxmox_vmid", sa.Integer(), nullable=True),
        sa.Column("hostname", sa.String(100), nullable=False),
        sa.Column("os_template", sa.String(150), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="creating"),
        sa.Column("rdns", sa.String(255), nullable=True),
        sa.Column("idempotency_key", sa.String(64), unique=True, nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── transactions ──────────────────────────────
    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("server_id", sa.Integer(), sa.ForeignKey("servers.id"), nullable=True),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("balance_after", sa.Float(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── os_templates ──────────────────────────────
    op.create_table(
        "os_templates",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(80), unique=True, nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("proxmox_template", sa.String(255), nullable=False),
        sa.Column("icon_url", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── activity_logs ─────────────────────────────
    op.create_table(
        "activity_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("target_type", sa.String(50), nullable=True),
        sa.Column("target_id", sa.Integer(), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("activity_logs")
    op.drop_table("os_templates")
    op.drop_table("transactions")
    op.drop_table("servers")
    op.drop_table("ip_addresses")
    op.drop_table("nodes")
    op.drop_table("plans")
    op.drop_table("users")
