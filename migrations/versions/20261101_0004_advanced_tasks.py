"""Add task deadlines, categories, states, recurrence, and search indexes.

Revision ID: 20261101_0004
Revises: 20261101_0003
Create Date: 2026-11-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20261101_0004"
down_revision: Union[str, None] = "20261101_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("category", sa.String(length=80), nullable=True))
    op.add_column("tasks", sa.Column("due_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tasks", sa.Column("status", sa.String(length=20), nullable=True))
    op.execute("UPDATE tasks SET status = CASE WHEN completed THEN 'completed' ELSE 'pending' END")
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.alter_column("status", existing_type=sa.String(length=20), nullable=False,
                              server_default="pending")
    op.add_column("tasks", sa.Column("recurrence_rule", sa.String(length=20), server_default="none", nullable=False))
    op.add_column("tasks", sa.Column("parent_task_id", sa.Integer(), nullable=True))
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.create_foreign_key(
            "fk_tasks_parent_task_id_tasks", "tasks", ["parent_task_id"], ["id"], ondelete="SET NULL"
        )
    op.create_index("ix_tasks_category", "tasks", ["category"])
    op.create_index("ix_tasks_due_at", "tasks", ["due_at"])
    op.create_index("ix_tasks_parent_task_id", "tasks", ["parent_task_id"])


def downgrade() -> None:
    op.drop_index("ix_tasks_parent_task_id", table_name="tasks")
    op.drop_index("ix_tasks_due_at", table_name="tasks")
    op.drop_index("ix_tasks_category", table_name="tasks")
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.drop_constraint("fk_tasks_parent_task_id_tasks", type_="foreignkey")
        batch_op.drop_column("parent_task_id")
    op.drop_column("tasks", "recurrence_rule")
    op.drop_column("tasks", "status")
    op.drop_column("tasks", "due_at")
    op.drop_column("tasks", "category")
