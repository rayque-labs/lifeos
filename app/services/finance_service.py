from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.finance import FinanceAccount, FinanceCategory, FinanceTransaction
from app.schemas.finance import AccountCreate, AccountUpdate, CategoryCreate, TransactionCreate, TransactionUpdate

ZERO = Decimal("0.00")


class FinanceValidationError(ValueError):
    pass


class FinanceConflictError(ValueError):
    pass


class AccountHasTransactions(ValueError):
    pass


def list_accounts(db: Session, user_id: int) -> list[dict]:
    accounts = db.query(FinanceAccount).filter(FinanceAccount.user_id == user_id).order_by(FinanceAccount.name).all()
    totals = db.query(
        FinanceTransaction.account_id,
        FinanceTransaction.kind,
        func.sum(FinanceTransaction.amount),
    ).filter(FinanceTransaction.user_id == user_id).group_by(
        FinanceTransaction.account_id, FinanceTransaction.kind
    ).all()
    amounts = {(account_id, kind): amount or ZERO for account_id, kind, amount in totals}
    return [
        {
            "id": account.id,
            "name": account.name,
            "currency": account.currency,
            "opening_balance": account.opening_balance,
            "balance": account.opening_balance
            + amounts.get((account.id, "income"), ZERO)
            - amounts.get((account.id, "expense"), ZERO),
        }
        for account in accounts
    ]


def create_account(db: Session, user_id: int, payload: AccountCreate) -> dict:
    account = FinanceAccount(**payload.model_dump(), user_id=user_id)
    db.add(account)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise FinanceConflictError("An account with this name already exists") from None
    db.refresh(account)
    return next(item for item in list_accounts(db, user_id) if item["id"] == account.id)


def update_account(db: Session, user_id: int, account_id: int, payload: AccountUpdate) -> dict | None:
    account = db.query(FinanceAccount).filter(
        FinanceAccount.id == account_id, FinanceAccount.user_id == user_id
    ).first()
    if account is None:
        return None
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise FinanceConflictError("An account with this name already exists") from None
    db.refresh(account)
    return next(item for item in list_accounts(db, user_id) if item["id"] == account.id)


def delete_account(db: Session, user_id: int, account_id: int) -> bool:
    account = db.query(FinanceAccount).filter(
        FinanceAccount.id == account_id, FinanceAccount.user_id == user_id
    ).first()
    if account is None:
        return False
    if db.query(FinanceTransaction.id).filter(FinanceTransaction.account_id == account_id).first():
        raise AccountHasTransactions("Accounts with transaction history cannot be deleted")
    db.delete(account)
    db.commit()
    return True


def create_category(db: Session, user_id: int, payload: CategoryCreate) -> FinanceCategory:
    category = FinanceCategory(**payload.model_dump(), user_id=user_id)
    db.add(category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise FinanceConflictError("This category already exists") from None
    db.refresh(category)
    return category


def list_categories(db: Session, user_id: int) -> list[FinanceCategory]:
    return db.query(FinanceCategory).filter(FinanceCategory.user_id == user_id).order_by(
        FinanceCategory.kind, FinanceCategory.name
    ).all()


def delete_category(db: Session, user_id: int, category_id: int) -> bool:
    category = db.query(FinanceCategory).filter(
        FinanceCategory.id == category_id, FinanceCategory.user_id == user_id
    ).first()
    if category is None:
        return False
    db.delete(category)
    db.commit()
    return True


def _validate_transaction_refs(
    db: Session, user_id: int, account_id: int, category_id: int | None, kind: str
) -> bool:
    if db.query(FinanceAccount.id).filter(
        FinanceAccount.id == account_id, FinanceAccount.user_id == user_id
    ).first() is None:
        return False
    if category_id is not None:
        category = db.query(FinanceCategory).filter(
            FinanceCategory.id == category_id, FinanceCategory.user_id == user_id
        ).first()
        if category is None:
            return False
        if category.kind != kind:
            raise FinanceValidationError("Category type must match the transaction type")
    return True


def list_transactions(
    db: Session,
    user_id: int,
    *,
    account_id: int | None,
    category_id: int | None,
    kind: str | None,
    from_date: date | None,
    to_date: date | None,
    limit: int,
    offset: int,
) -> list[FinanceTransaction]:
    query = db.query(FinanceTransaction).filter(FinanceTransaction.user_id == user_id)
    if account_id is not None:
        query = query.filter(FinanceTransaction.account_id == account_id)
    if category_id is not None:
        query = query.filter(FinanceTransaction.category_id == category_id)
    if kind:
        query = query.filter(FinanceTransaction.kind == kind)
    if from_date:
        query = query.filter(FinanceTransaction.occurred_on >= from_date)
    if to_date:
        query = query.filter(FinanceTransaction.occurred_on <= to_date)
    return query.order_by(FinanceTransaction.occurred_on.desc(), FinanceTransaction.id.desc()).offset(offset).limit(limit).all()


def create_transaction(db: Session, user_id: int, payload: TransactionCreate) -> FinanceTransaction | None:
    if not _validate_transaction_refs(db, user_id, payload.account_id, payload.category_id, payload.kind):
        return None
    transaction = FinanceTransaction(**payload.model_dump(), user_id=user_id)
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


def update_transaction(
    db: Session, user_id: int, transaction_id: int, payload: TransactionUpdate
) -> FinanceTransaction | None:
    transaction = db.query(FinanceTransaction).filter(
        FinanceTransaction.id == transaction_id, FinanceTransaction.user_id == user_id
    ).first()
    if transaction is None:
        return None
    updates = payload.model_dump(exclude_unset=True)
    account_id = updates.get("account_id", transaction.account_id)
    category_id = updates.get("category_id", transaction.category_id)
    kind = updates.get("kind", transaction.kind)
    if not _validate_transaction_refs(db, user_id, account_id, category_id, kind):
        return None
    for field, value in updates.items():
        setattr(transaction, field, value)
    db.commit()
    db.refresh(transaction)
    return transaction


def delete_transaction(db: Session, user_id: int, transaction_id: int) -> bool:
    transaction = db.query(FinanceTransaction).filter(
        FinanceTransaction.id == transaction_id, FinanceTransaction.user_id == user_id
    ).first()
    if transaction is None:
        return False
    db.delete(transaction)
    db.commit()
    return True


def monthly_summary(db: Session, user_id: int, year: int, month: int) -> dict:
    start = date(year, month, 1)
    next_month = date(year + (month == 12), 1 if month == 12 else month + 1, 1)
    transactions = db.query(FinanceTransaction, FinanceAccount.currency, FinanceCategory.name).join(
        FinanceAccount, FinanceAccount.id == FinanceTransaction.account_id
    ).outerjoin(FinanceCategory, FinanceCategory.id == FinanceTransaction.category_id).filter(
        FinanceTransaction.user_id == user_id,
        FinanceTransaction.occurred_on >= start,
        FinanceTransaction.occurred_on < next_month,
    ).all()
    totals = defaultdict(lambda: {"income": ZERO, "expenses": ZERO, "categories": defaultdict(lambda: ZERO)})
    for transaction, currency, category_name in transactions:
        totals[currency][transaction.kind if transaction.kind == "income" else "expenses"] += transaction.amount
        label = category_name or "Uncategorized"
        totals[currency]["categories"][(label, transaction.kind)] += transaction.amount
    currencies = []
    for currency in sorted(totals):
        data = totals[currency]
        categories = [
            {"category": label, "kind": kind, "total": amount}
            for (label, kind), amount in sorted(data["categories"].items())
        ]
        currencies.append({
            "currency": currency,
            "income": data["income"],
            "expenses": data["expenses"],
            "net": data["income"] - data["expenses"],
            "categories": categories,
        })
    return {"month": f"{year:04d}-{month:02d}", "currencies": currencies}
