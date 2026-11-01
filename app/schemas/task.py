from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: str | None = None
    priority: str = Field(default="medium", pattern="^(low|medium|high)$")


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    priority: str | None = Field(default=None, pattern="^(low|medium|high)$")
    completed: bool | None = None


class TaskResponse(BaseModel):
    id: int
    title: str
    description: str | None
    priority: str
    completed: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
