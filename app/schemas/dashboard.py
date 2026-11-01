from datetime import datetime

from pydantic import BaseModel

from app.schemas.finance import AccountResponse, MonthlySummary
from app.schemas.calendar_event import CalendarEventResponse


class TaskDashboard(BaseModel):
    total: int
    pending: int
    in_progress: int
    completed: int
    overdue: int
    due_today: int


class ProjectDashboard(BaseModel):
    active: int
    average_progress: float


class HabitDashboard(BaseModel):
    id: int
    name: str
    frequency: str
    target_per_week: int
    checked_in_today: bool
    current_streak: int
    consistency_percentage: float


class FinanceDashboard(BaseModel):
    accounts: list[AccountResponse]
    monthly: MonthlySummary


class DashboardResponse(BaseModel):
    generated_at: datetime
    tasks: TaskDashboard
    projects: ProjectDashboard
    habits_today: list[HabitDashboard]
    upcoming_events: list[CalendarEventResponse]
    finance: FinanceDashboard
