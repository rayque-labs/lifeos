from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def normalize_tags(values: list[str]) -> list[str]:
    normalized = list(dict.fromkeys(tag.strip().lower() for tag in values if tag.strip()))
    if len(normalized) > 30 or any(len(tag) > 40 for tag in normalized):
        raise ValueError("Notes allow up to 30 tags, each no longer than 40 characters")
    return normalized


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=100_000)
    category: str | None = Field(default=None, max_length=80)
    tags: list[str] = Field(default_factory=list, max_length=30)
    pinned: bool = False

    @field_validator("title", "category")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, value: list[str]) -> list[str]:
        return normalize_tags(value)


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = Field(default=None, min_length=1, max_length=100_000)
    category: str | None = Field(default=None, max_length=80)
    tags: list[str] | None = Field(default=None, max_length=30)
    pinned: bool | None = None

    @field_validator("title", "category")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, value: list[str] | None) -> list[str] | None:
        return normalize_tags(value) if value is not None else None

    @field_validator("title", "content", "tags", "pinned")
    @classmethod
    def reject_null_for_required_fields(cls, value):
        if value is None:
            raise ValueError("This field cannot be null")
        return value


class NoteResponse(BaseModel):
    id: int
    title: str
    content: str
    category: str | None
    tags: list[str]
    pinned: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
