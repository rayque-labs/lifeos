"""Add accounts, categories, and Decimal personal finance transactions.

Revision ID: 20261101_0009
Revises: 20261101_0008
Create Date: 2026-11-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20261101_0009"
down_revision: Union[str, None] = "20261101_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "finance_accounts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="USD", nullable=False),
        sa.Column("opening_balance", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_finance_accounts_user_name"),
    )
    op.create_index("ix_finance_accounts_user_id", "finance_accounts", ["user_id"])
    op.create_table(
        "finance_categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", "kind", name="uq_finance_categories_user_name_kind"),
    )
    op.create_index("ix_finance_categories_user_id", "finance_categories", ["user_id"])
    op.create_table(
        "finance_transactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["finance_accounts.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["category_id"], ["finance_categories.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_finance_transactions_user_id", "finance_transactions", ["user_id"])
    op.create_index("ix_finance_transactions_account_id", "finance_transactions", ["account_id"])
    op.create_index("ix_finance_transactions_category_id", "finance_transactions", ["category_id"])
    op.create_index("ix_finance_transactions_occurred_on", "finance_transactions", ["occurred_on"])


def downgrade() -> None:
    op.drop_index("ix_finance_transactions_occurred_on", table_name="finance_transactions")
    op.drop_index("ix_finance_transactions_category_id", table_name="finance_transactions")
    op.drop_index("ix_finance_transactions_account_id", table_name="finance_transactions")
    op.drop_index("ix_finance_transactions_user_id", table_name="finance_transactions")
    op.drop_table("finance_transactions")
    op.drop_index("ix_finance_categories_user_id", table_name="finance_categories")
    op.drop_table("finance_categories")
    op.drop_index("ix_finance_accounts_user_id", table_name="finance_accounts")
    op.drop_table("finance_accounts")
