from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

TransactionKind = Literal["income", "expense"]
CurrencyCode = str
Money = Decimal
_MONEY = Field(max_digits=14, decimal_places=2)


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    currency: str = Field(default="USD", min_length=3, max_length=3, pattern="^[A-Za-z]{3}$")
    opening_balance: Money = Field(default=Decimal("0.00"), max_digits=14, decimal_places=2)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be blank")
        return value

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()

    @field_validator("opening_balance")
    @classmethod
    def validate_opening_balance(cls, value: Decimal) -> Decimal:
        return value


class AccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    opening_balance: Decimal | None = Field(default=None, max_digits=14, decimal_places=2)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be blank")
        return value

    @field_validator("opening_balance")
    @classmethod
    def validate_opening_balance(cls, value: Decimal | None) -> Decimal | None:
        return value

    @model_validator(mode="after")
    def reject_null_required_fields(self):
        for field in ("name", "opening_balance"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class AccountResponse(BaseModel):
    id: int
    name: str
    currency: str
    opening_balance: Decimal
    balance: Decimal

    model_config = ConfigDict(from_attributes=True)


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    kind: TransactionKind

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be blank")
        return value


class CategoryResponse(BaseModel):
    id: int
    name: str
    kind: str

    model_config = ConfigDict(from_attributes=True)


class TransactionCreate(BaseModel):
    account_id: int
    category_id: int | None = None
    kind: TransactionKind
    title: str = Field(min_length=1, max_length=160)
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    occurred_on: date
    description: str | None = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be blank")
        return value


class TransactionUpdate(BaseModel):
    account_id: int | None = None
    category_id: int | None = None
    kind: TransactionKind | None = None
    title: str | None = Field(default=None, min_length=1, max_length=160)
    amount: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    occurred_on: date | None = None
    description: str | None = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be blank")
        return value

    @model_validator(mode="after")
    def reject_null_required_fields(self):
        for field in ("account_id", "kind", "title", "amount", "occurred_on"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class TransactionResponse(BaseModel):
    id: int
    account_id: int
    category_id: int | None
    kind: str
    title: str
    amount: Decimal
    occurred_on: date
    description: str | None

    model_config = ConfigDict(from_attributes=True)


class CategoryTotal(BaseModel):
    category: str
    kind: str
    total: Decimal


class CurrencySummary(BaseModel):
    currency: str
    income: Decimal
    expenses: Decimal
    net: Decimal
    categories: list[CategoryTotal]


class MonthlySummary(BaseModel):
    month: str
    currencies: list[CurrencySummary]
