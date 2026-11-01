from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

TaskPriority = Literal["low", "medium", "high"]
TaskStatus = Literal["pending", "in_progress", "completed"]
RecurrenceRule = Literal["none", "daily", "weekly", "monthly"]
TaskSortField = Literal["created_at", "due_at", "priority", "title", "status"]


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: str | None = None
    priority: TaskPriority = "medium"
    category: str | None = Field(default=None, max_length=80)
    project_id: int | None = None
    due_at: AwareDatetime | None = None
    status: TaskStatus = "pending"
    completed: bool = False
    recurrence_rule: RecurrenceRule = "none"

    @field_validator("title", "category")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value

    @model_validator(mode="after")
    def validate_task_state(self):
        if self.status == "completed" and not self.completed:
            raise ValueError("completed must be true when status is completed")
        if self.completed and self.status != "completed":
            raise ValueError("status must be completed when completed is true")
        if self.recurrence_rule != "none" and self.due_at is None:
            raise ValueError("Recurring tasks require a due_at date")
        return self


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    priority: TaskPriority | None = None
    category: str | None = Field(default=None, max_length=80)
    project_id: int | None = None
    due_at: AwareDatetime | None = None
    status: TaskStatus | None = None
    completed: bool | None = None
    recurrence_rule: RecurrenceRule | None = None

    @field_validator("title", "category")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value

    @model_validator(mode="after")
    def validate_task_state(self):
        for field in ("title", "priority", "status", "completed", "recurrence_rule"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        if self.status is not None and self.completed is not None:
            if (self.status == "completed") != self.completed:
                raise ValueError("status and completed must describe the same state")
        if "recurrence_rule" in self.model_fields_set and self.recurrence_rule != "none":
            if self.due_at is None:
                raise ValueError("Set due_at when enabling task recurrence")
        return self


class TaskResponse(BaseModel):
    id: int
    user_id: int | None
    title: str
    description: str | None
    priority: str
    category: str | None
    due_at: datetime | None
    status: str
    recurrence_rule: str
    parent_task_id: int | None
    project_id: int | None
    completed: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
