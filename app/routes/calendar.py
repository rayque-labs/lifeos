from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import AwareDatetime
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.calendar_event import CalendarEventCreate, CalendarEventResponse, CalendarEventUpdate
from app.services import calendar_service

router = APIRouter(prefix="/calendar/events", tags=["Calendar"])


@router.post("/", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
def create_event(payload: CalendarEventCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    event = calendar_service.create_event(db, payload, user.id)
    if event is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return event


@router.get("/", response_model=list[CalendarEventResponse])
def list_events(
    starts_after: AwareDatetime | None = None,
    starts_before: AwareDatetime | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if starts_after and starts_before and starts_after >= starts_before:
        raise HTTPException(status_code=422, detail="starts_before must be later than starts_after")
    return calendar_service.list_events(db, user.id, starts_after, starts_before)


@router.get("/{event_id}", response_model=CalendarEventResponse)
def get_event(event_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    event = calendar_service.get_event(db, event_id, user.id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.patch("/{event_id}", response_model=CalendarEventResponse)
def update_event(
    event_id: int,
    payload: CalendarEventUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        event = calendar_service.update_event(db, event_id, payload, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if event is None:
        raise HTTPException(status_code=404, detail="Event or task not found")
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not calendar_service.delete_event(db, event_id, user.id):
        raise HTTPException(status_code=404, detail="Event not found")
