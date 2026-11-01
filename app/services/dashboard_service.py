from datetime import datetime, time, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.calendar_event import CalendarEvent
from app.models.habit import HabitLog
from app.models.task import Task
from app.services import finance_service, habit_service, project_service


def get_dashboard(db: Session, user_id: int) -> dict:
    now = datetime.now(timezone.utc)
    today = now.date()
    tomorrow = today + timedelta(days=1)
    counts = dict(db.query(Task.status, func.count(Task.id)).filter(
        Task.user_id == user_id
    ).group_by(Task.status).all())
    overdue = db.query(func.count(Task.id)).filter(
        Task.user_id == user_id,
        Task.completed.is_(False),
        Task.due_at < now,
    ).scalar() or 0
    due_today = db.query(func.count(Task.id)).filter(
        Task.user_id == user_id,
        Task.completed.is_(False),
        Task.due_at >= datetime.combine(today, time.min, tzinfo=timezone.utc),
        Task.due_at < datetime.combine(tomorrow, time.min, tzinfo=timezone.utc),
    ).scalar() or 0
    project_data = project_service.list_projects(db, user_id, status="active")
    project_progress = (
        sum(project["progress"] for project in project_data) / len(project_data) if project_data else 0.0
    )

    active_habits = habit_service.list_habits(db, user_id, active=True)
    habit_ids = [habit["id"] for habit in active_habits]
    checked_today: set[int] = set()
    if habit_ids:
        checked_today = {row[0] for row in db.query(HabitLog.habit_id).filter(
            HabitLog.user_id == user_id,
            HabitLog.habit_id.in_(habit_ids),
            HabitLog.logged_on == today,
        ).all()}
    habits_today = [
        {
            "id": habit["id"],
            "name": habit["name"],
            "frequency": habit["frequency"],
            "target_per_week": habit["target_per_week"],
            "checked_in_today": habit["id"] in checked_today,
            "current_streak": habit["current_streak"],
            "consistency_percentage": habit["consistency_percentage"],
        }
        for habit in active_habits
    ]
    upcoming_events = db.query(CalendarEvent).filter(
        CalendarEvent.user_id == user_id,
        CalendarEvent.starts_at >= now,
        CalendarEvent.starts_at < now + timedelta(days=7),
    ).order_by(CalendarEvent.starts_at.asc()).limit(20).all()

    return {
        "generated_at": now,
        "tasks": {
            "total": sum(counts.values()),
            "pending": counts.get("pending", 0),
            "in_progress": counts.get("in_progress", 0),
            "completed": counts.get("completed", 0),
            "overdue": overdue,
            "due_today": due_today,
        },
        "projects": {"active": len(project_data), "average_progress": round(project_progress, 1)},
        "habits_today": habits_today,
        "upcoming_events": upcoming_events,
        "finance": {
            "accounts": finance_service.list_accounts(db, user_id),
            "monthly": finance_service.monthly_summary(db, user_id, today.year, today.month),
        },
    }
