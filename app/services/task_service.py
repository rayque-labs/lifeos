import calendar
from datetime import datetime, timedelta

from sqlalchemy import case, or_
from sqlalchemy.orm import Session

from app.models.task import Task
from app.models.project import Project
from app.schemas.task import TaskCreate, TaskSortField, TaskStatus, TaskUpdate


def create_task(db: Session, task_data: TaskCreate, user_id: int) -> Task | None:
    if task_data.project_id is not None and not db.query(Project).filter(
        Project.id == task_data.project_id, Project.user_id == user_id
    ).first():
        return None
    task = Task(**task_data.model_dump(), user_id=user_id)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def get_tasks(
    db: Session,
    user_id: int,
    *,
    status: TaskStatus | None = None,
    priority: str | None = None,
    category: str | None = None,
    query_text: str | None = None,
    due_before: datetime | None = None,
    due_after: datetime | None = None,
    sort_by: TaskSortField = "created_at",
    sort_order: str = "desc",
) -> list[Task]:
    query = db.query(Task).filter(Task.user_id == user_id)
    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    if category:
        query = query.filter(Task.category == category)
    if query_text:
        search = f"%{query_text.strip()}%"
        query = query.filter(or_(Task.title.ilike(search), Task.description.ilike(search)))
    if due_before:
        query = query.filter(Task.due_at <= due_before)
    if due_after:
        query = query.filter(Task.due_at >= due_after)

    sort_columns = {
        "created_at": Task.created_at,
        "due_at": Task.due_at,
        "priority": case((Task.priority == "high", 0), (Task.priority == "medium", 1), else_=2),
        "title": Task.title,
        "status": case((Task.status == "pending", 0), (Task.status == "in_progress", 1), else_=2),
    }
    sort_column = sort_columns[sort_by]
    ordering = sort_column.desc() if sort_order == "desc" else sort_column.asc()
    if sort_by == "due_at":
        ordering = ordering.nullslast()
    return query.order_by(ordering, Task.id.asc()).all()


def get_task(db: Session, task_id: int, user_id: int) -> Task | None:
    return db.query(Task).filter(Task.id == task_id, Task.user_id == user_id).first()


def _next_due_date(due_at: datetime, recurrence_rule: str) -> datetime:
    if recurrence_rule == "daily":
        return due_at + timedelta(days=1)
    if recurrence_rule == "weekly":
        return due_at + timedelta(weeks=1)
    next_month = due_at.month % 12 + 1
    next_year = due_at.year + (due_at.month // 12)
    next_day = min(due_at.day, calendar.monthrange(next_year, next_month)[1])
    return due_at.replace(year=next_year, month=next_month, day=next_day)


def update_task(db: Session, task_id: int, task_data: TaskUpdate, user_id: int) -> Task | None:
    task = get_task(db, task_id, user_id)
    if task is None:
        return None

    updates = task_data.model_dump(exclude_unset=True)
    if "project_id" in updates and updates["project_id"] is not None and not db.query(Project).filter(
        Project.id == updates["project_id"], Project.user_id == user_id
    ).first():
        return None
    was_completed = task.completed
    for field, value in updates.items():
        setattr(task, field, value)

    if "status" in updates:
        task.completed = task.status == "completed"
    elif "completed" in updates:
        task.status = "completed" if task.completed else "pending"

    should_repeat = not was_completed and task.completed and task.recurrence_rule != "none" and task.due_at
    if should_repeat:
        db.add(Task(
            user_id=task.user_id,
            title=task.title,
            description=task.description,
            priority=task.priority,
            category=task.category,
            due_at=_next_due_date(task.due_at, task.recurrence_rule),
            status="pending",
            completed=False,
            recurrence_rule=task.recurrence_rule,
            parent_task_id=task.id,
            project_id=task.project_id,
        ))

    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task_id: int, user_id: int) -> bool:
    task = get_task(db, task_id, user_id)
    if task is None:
        return False
    db.delete(task)
    db.commit()
    return True
