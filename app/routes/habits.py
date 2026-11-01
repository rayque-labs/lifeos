from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.habit import HabitCreate, HabitLogCreate, HabitLogResponse, HabitResponse, HabitUpdate
from app.services import habit_service

router = APIRouter(prefix="/habits", tags=["Habits"])


@router.post("/", response_model=HabitResponse, status_code=status.HTTP_201_CREATED)
def create_habit(payload: HabitCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return habit_service.create_habit(db, payload, user.id)


@router.get("/", response_model=list[HabitResponse])
def list_habits(active: bool | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return habit_service.list_habits(db, user.id, active)


@router.get("/{habit_id}", response_model=HabitResponse)
def get_habit(habit_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    habit = habit_service.get_habit(db, habit_id, user.id)
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    return habit


@router.patch("/{habit_id}", response_model=HabitResponse)
def update_habit(
    habit_id: int,
    payload: HabitUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        habit = habit_service.update_habit(db, habit_id, payload, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    return habit


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(habit_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not habit_service.delete_habit(db, habit_id, user.id):
        raise HTTPException(status_code=404, detail="Habit not found")


@router.post("/{habit_id}/logs", response_model=HabitLogResponse, status_code=status.HTTP_200_OK)
def record_habit(
    habit_id: int,
    payload: HabitLogCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.logged_on > datetime.now(timezone.utc).date():
        raise HTTPException(status_code=422, detail="Habit logs cannot be in the future")
    log = habit_service.save_log(db, habit_id, user.id, payload.logged_on, payload.note)
    if log is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    return log


@router.get("/{habit_id}/logs", response_model=list[HabitLogResponse])
def get_habit_history(
    habit_id: int,
    from_date: date | None = None,
    to_date: date | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422, detail="from_date must be on or before to_date")
    logs = habit_service.list_logs(db, habit_id, user.id, from_date, to_date)
    if logs is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    return logs


@router.delete("/{habit_id}/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit_log(
    habit_id: int,
    log_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not habit_service.delete_log(db, habit_id, log_id, user.id):
        raise HTTPException(status_code=404, detail="Habit log not found")
