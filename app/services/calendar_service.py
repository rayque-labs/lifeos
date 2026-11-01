from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.calendar_event import CalendarEvent
from app.models.task import Task
from app.schemas.calendar_event import CalendarEventCreate, CalendarEventUpdate


def _owned_task(db: Session, task_id: int | None, user_id: int) -> bool:
    return task_id is None or db.query(Task.id).filter(Task.id == task_id, Task.user_id == user_id).first() is not None


def list_events(db: Session, user_id: int, starts_after: datetime | None, starts_before: datetime | None) -> list[CalendarEvent]:
    query = db.query(CalendarEvent).filter(CalendarEvent.user_id == user_id)
    if starts_after:
        query = query.filter(CalendarEvent.starts_at >= starts_after)
    if starts_before:
        query = query.filter(CalendarEvent.starts_at < starts_before)
    return query.order_by(CalendarEvent.starts_at.asc(), CalendarEvent.id.asc()).all()


def get_event(db: Session, event_id: int, user_id: int) -> CalendarEvent | None:
    return db.query(CalendarEvent).filter(CalendarEvent.id == event_id, CalendarEvent.user_id == user_id).first()


def create_event(db: Session, payload: CalendarEventCreate, user_id: int) -> CalendarEvent | None:
    if not _owned_task(db, payload.task_id, user_id):
        return None
    event = CalendarEvent(**payload.model_dump(), user_id=user_id)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def update_event(db: Session, event_id: int, payload: CalendarEventUpdate, user_id: int) -> CalendarEvent | None:
    event = get_event(db, event_id, user_id)
    if event is None:
        return None
    updates = payload.model_dump(exclude_unset=True)
    if "task_id" in updates and not _owned_task(db, updates["task_id"], user_id):
        return None
    start = updates.get("starts_at", event.starts_at)
    end = updates.get("ends_at", event.ends_at)
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    if end.tzinfo is None:
        end = end.replace(tzinfo=UTC)
    if end <= start:
        raise ValueError("ends_at must be later than starts_at")
    for field, value in updates.items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


def delete_event(db: Session, event_id: int, user_id: int) -> bool:
    event = get_event(db, event_id, user_id)
    if event is None:
        return False
    db.delete(event)
    db.commit()
    return True
