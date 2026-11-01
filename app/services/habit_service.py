from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.habit import Habit, HabitLog
from app.schemas.habit import HabitCreate, HabitUpdate


def _current_streak(habit: Habit, log_dates: set[date], today: date) -> int:
    if habit.frequency == "daily":
        cursor = today if today in log_dates else today - timedelta(days=1)
        streak = 0
        while cursor in log_dates:
            streak += 1
            cursor -= timedelta(days=1)
        return streak

    week_start = today - timedelta(days=today.weekday())
    weekly_counts: dict[tuple[int, int], int] = {}
    for logged_on in log_dates:
        iso = logged_on.isocalendar()
        key = (iso.year, iso.week)
        weekly_counts[key] = weekly_counts.get(key, 0) + 1
    current_iso = week_start.isocalendar()
    if weekly_counts.get((current_iso.year, current_iso.week), 0) < habit.target_per_week:
        week_start -= timedelta(weeks=1)
    streak = 0
    while True:
        iso = week_start.isocalendar()
        if weekly_counts.get((iso.year, iso.week), 0) < habit.target_per_week:
            break
        streak += 1
        week_start -= timedelta(weeks=1)
    return streak


def _with_metrics(db: Session, habit: Habit) -> dict:
    today = datetime.now(timezone.utc).date()
    window_start = today - timedelta(days=29)
    all_dates = db.scalars(select(HabitLog.logged_on).where(
        HabitLog.habit_id == habit.id,
        HabitLog.user_id == habit.user_id,
        HabitLog.logged_on <= today,
    )).all()
    recent_dates = {logged_on for logged_on in all_dates if logged_on >= window_start}
    expected = 30 if habit.frequency == "daily" else 30 * habit.target_per_week / 7
    # Keep the expected count from turning an overachieving habit into >100%.
    consistency = min(100.0, len(recent_dates) / expected * 100) if expected else 0.0
    return {
        "id": habit.id,
        "name": habit.name,
        "description": habit.description,
        "frequency": habit.frequency,
        "target_per_week": habit.target_per_week,
        "active": habit.active,
        "current_streak": _current_streak(habit, set(all_dates), today),
        "consistency_percentage": round(consistency, 1),
        "log_count_30_days": len(recent_dates),
        "created_at": habit.created_at,
    }


def list_habits(db: Session, user_id: int, active: bool | None = None) -> list[dict]:
    query = db.query(Habit).filter(Habit.user_id == user_id)
    if active is not None:
        query = query.filter(Habit.active.is_(active))
    return [_with_metrics(db, habit) for habit in query.order_by(Habit.created_at.desc()).all()]


def get_habit(db: Session, habit_id: int, user_id: int) -> dict | None:
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    return _with_metrics(db, habit) if habit else None


def create_habit(db: Session, payload: HabitCreate, user_id: int) -> dict:
    habit = Habit(**payload.model_dump(), user_id=user_id)
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return _with_metrics(db, habit)


def update_habit(db: Session, habit_id: int, payload: HabitUpdate, user_id: int) -> dict | None:
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    if not habit:
        return None
    updates = payload.model_dump(exclude_unset=True)
    if "frequency" in updates and "target_per_week" not in updates:
        updates["target_per_week"] = 7 if updates["frequency"] == "daily" else 1
    effective_frequency = updates.get("frequency", habit.frequency)
    effective_target = updates.get("target_per_week", habit.target_per_week)
    if effective_frequency == "daily" and effective_target != 7:
        raise ValueError("Daily habits require a target of seven days per week")
    for field, value in updates.items():
        setattr(habit, field, value)
    db.commit()
    db.refresh(habit)
    return _with_metrics(db, habit)


def delete_habit(db: Session, habit_id: int, user_id: int) -> bool:
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    if not habit:
        return False
    db.delete(habit)
    db.commit()
    return True


def save_log(db: Session, habit_id: int, user_id: int, logged_on: date, note: str | None) -> HabitLog | None:
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    if habit is None:
        return None
    log = db.scalar(select(HabitLog).where(
        HabitLog.habit_id == habit_id,
        HabitLog.user_id == user_id,
        HabitLog.logged_on == logged_on,
    ))
    if log is None:
        log = HabitLog(habit_id=habit_id, user_id=user_id, logged_on=logged_on, note=note)
        db.add(log)
    else:
        log.note = note
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        log = db.scalar(select(HabitLog).where(
            HabitLog.habit_id == habit_id,
            HabitLog.user_id == user_id,
            HabitLog.logged_on == logged_on,
        ))
        if log is None:
            raise
        log.note = note
        db.commit()
    db.refresh(log)
    return log


def list_logs(db: Session, habit_id: int, user_id: int, from_date: date | None, to_date: date | None) -> list[HabitLog] | None:
    if not db.query(Habit.id).filter(Habit.id == habit_id, Habit.user_id == user_id).first():
        return None
    query = db.query(HabitLog).filter(HabitLog.habit_id == habit_id, HabitLog.user_id == user_id)
    if from_date:
        query = query.filter(HabitLog.logged_on >= from_date)
    if to_date:
        query = query.filter(HabitLog.logged_on <= to_date)
    return query.order_by(HabitLog.logged_on.desc()).all()


def delete_log(db: Session, habit_id: int, log_id: int, user_id: int) -> bool:
    log = db.query(HabitLog).filter(
        HabitLog.id == log_id,
        HabitLog.habit_id == habit_id,
        HabitLog.user_id == user_id,
    ).first()
    if not log:
        return False
    db.delete(log)
    db.commit()
    return True
