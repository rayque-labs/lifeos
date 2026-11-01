import re
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.finance import (
    AccountCreate, AccountResponse, AccountUpdate, CategoryCreate, CategoryResponse,
    MonthlySummary, TransactionCreate, TransactionResponse, TransactionUpdate,
)
from app.services import finance_service

router = APIRouter(prefix="/finance", tags=["Personal Finance"])


def _raise_finance_validation(exc: ValueError):
    raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(payload: AccountCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        return finance_service.create_account(db, user.id, payload)
    except finance_service.FinanceConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/accounts", response_model=list[AccountResponse])
def list_accounts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return finance_service.list_accounts(db, user.id)


@router.patch("/accounts/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: int,
    payload: AccountUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        account = finance_service.update_account(db, user.id, account_id, payload)
    except finance_service.FinanceConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(account_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        deleted = finance_service.delete_account(db, user.id, account_id)
    except finance_service.AccountHasTransactions as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Account not found")


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        return finance_service.create_category(db, user.id, payload)
    except finance_service.FinanceConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/categories", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return finance_service.list_categories(db, user.id)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not finance_service.delete_category(db, user.id, category_id):
        raise HTTPException(status_code=404, detail="Category not found")


@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        transaction = finance_service.create_transaction(db, user.id, payload)
    except finance_service.FinanceValidationError as exc:
        _raise_finance_validation(exc)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Account or category not found")
    return transaction


@router.get("/transactions", response_model=list[TransactionResponse])
def list_transactions(
    account_id: int | None = None,
    category_id: int | None = None,
    kind: Literal["income", "expense"] | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422, detail="from_date must be on or before to_date")
    return finance_service.list_transactions(
        db, user.id, account_id=account_id, category_id=category_id, kind=kind,
        from_date=from_date, to_date=to_date, limit=limit, offset=offset,
    )


@router.patch("/transactions/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        transaction = finance_service.update_transaction(db, user.id, transaction_id, payload)
    except finance_service.FinanceValidationError as exc:
        _raise_finance_validation(exc)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction, account, or category not found")
    return transaction


@router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not finance_service.delete_transaction(db, user.id, transaction_id):
        raise HTTPException(status_code=404, detail="Transaction not found")


@router.get("/summary/monthly", response_model=MonthlySummary)
def monthly_summary(
    month: str = Query(default_factory=lambda: date.today().strftime("%Y-%m"), pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
        raise HTTPException(status_code=422, detail="month must use YYYY-MM format")
    year, month_number = map(int, month.split("-"))
    return finance_service.monthly_summary(db, user.id, year, month_number)
