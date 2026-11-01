from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ProjectStatus = Literal["active", "paused", "completed", "archived"]
ProjectPriority = Literal["low", "medium", "high"]


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: str | None = None
    objective: str | None = Field(default=None, max_length=500)
    deadline: date | None = None
    status: ProjectStatus = "active"
    priority: ProjectPriority = "medium"

    @field_validator("title", "objective")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    objective: str | None = Field(default=None, max_length=500)
    deadline: date | None = None
    status: ProjectStatus | None = None
    priority: ProjectPriority | None = None

    @field_validator("title", "objective")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value

    @model_validator(mode="after")
    def reject_null_required_fields(self):
        for field in ("title", "status", "priority"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class ProjectResponse(BaseModel):
    id: int
    title: str
    description: str | None
    objective: str | None
    deadline: date | None
    status: str
    priority: str
    progress: float
    total_tasks: int
    completed_tasks: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
