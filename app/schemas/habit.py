from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

HabitFrequency = Literal["daily", "weekly"]


class HabitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    frequency: HabitFrequency = "daily"
    target_per_week: int | None = Field(default=None, ge=1, le=7)
    active: bool = True

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be blank")
        return value

    @model_validator(mode="after")
    def set_frequency_target(self):
        if self.target_per_week is None:
            self.target_per_week = 7 if self.frequency == "daily" else 1
        if self.frequency == "daily" and self.target_per_week != 7:
            raise ValueError("Daily habits require a target of seven days per week")
        return self


class HabitUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    frequency: HabitFrequency | None = None
    target_per_week: int | None = Field(default=None, ge=1, le=7)
    active: bool | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be blank")
        return value

    @model_validator(mode="after")
    def validate_frequency_target(self):
        if self.frequency == "daily" and self.target_per_week not in (None, 7):
            raise ValueError("Daily habits require a target of seven days per week")
        for field in ("name", "frequency", "target_per_week", "active"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class HabitLogCreate(BaseModel):
    logged_on: date
    note: str | None = Field(default=None, max_length=500)


class HabitLogResponse(BaseModel):
    id: int
    habit_id: int
    logged_on: date
    note: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HabitResponse(BaseModel):
    id: int
    name: str
    description: str | None
    frequency: str
    target_per_week: int
    active: bool
    current_streak: int
    consistency_percentage: float
    log_count_30_days: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
