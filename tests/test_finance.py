from decimal import Decimal


def test_finance_transactions_use_decimal_balances_and_monthly_summary(client):
    account = client.post(
        "/finance/accounts", json={"name": "Everyday", "currency": "brl", "opening_balance": "10.00"}
    )
    assert account.status_code == 201
    account_data = account.json()
    assert account_data["currency"] == "BRL"
    assert Decimal(account_data["balance"]) == Decimal("10.00")

    income_category = client.post("/finance/categories", json={"name": "Salary", "kind": "income"}).json()
    expense_category = client.post("/finance/categories", json={"name": "Food", "kind": "expense"}).json()
    assert client.post(
        "/finance/transactions",
        json={"account_id": account_data["id"], "category_id": income_category["id"], "kind": "income",
              "title": "Pay", "amount": "0.10", "occurred_on": "2026-11-10"},
    ).status_code == 201
    expense = client.post(
        "/finance/transactions",
        json={"account_id": account_data["id"], "category_id": expense_category["id"], "kind": "expense",
              "title": "Lunch", "amount": "0.20", "occurred_on": "2026-11-11"},
    )
    assert expense.status_code == 201

    balance = client.get("/finance/accounts").json()[0]["balance"]
    assert Decimal(balance) == Decimal("9.90")
    summary = client.get("/finance/summary/monthly", params={"month": "2026-11"})
    assert summary.status_code == 200
    currency = summary.json()["currencies"][0]
    assert currency["currency"] == "BRL"
    assert Decimal(currency["income"]) == Decimal("0.10")
    assert Decimal(currency["expenses"]) == Decimal("0.20")
    assert Decimal(currency["net"]) == Decimal("-0.10")
    assert client.delete(f"/finance/accounts/{account_data['id']}").status_code == 409


def test_finance_validates_category_type_and_ownership(client):
    account = client.post("/finance/accounts", json={"name": "Cash", "currency": "USD"}).json()
    category = client.post("/finance/categories", json={"name": "Groceries", "kind": "expense"}).json()
    mismatch = client.post(
        "/finance/transactions",
        json={"account_id": account["id"], "category_id": category["id"], "kind": "income",
              "title": "Bad category", "amount": "1.00", "occurred_on": "2026-11-01"},
    )
    assert mismatch.status_code == 422

    client.post(
        "/auth/register",
        json={"email": "finance-other@example.com", "full_name": "Other User", "password": "another-password-123"},
    )
    login = client.post(
        "/auth/login", json={"email": "finance-other@example.com", "password": "another-password-123"}
    )
    client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"
    assert client.get("/finance/accounts").json() == []
    assert client.get("/finance/categories").json() == []
    denied = client.post(
        "/finance/transactions",
        json={"account_id": account["id"], "kind": "expense", "title": "Cross-account", "amount": "1.00",
              "occurred_on": "2026-11-01"},
    )
    assert denied.status_code == 404


def test_finance_rejects_imprecise_or_nonpositive_amounts(client):
    account = client.post("/finance/accounts", json={"name": "Checking"}).json()
    invalid = client.post(
        "/finance/transactions",
        json={"account_id": account["id"], "kind": "expense", "title": "Bad amount", "amount": "0.001",
              "occurred_on": "2026-11-01"},
    )
    assert invalid.status_code == 422
    negative = client.post(
        "/finance/transactions",
        json={"account_id": account["id"], "kind": "expense", "title": "Negative", "amount": "-1.00",
              "occurred_on": "2026-11-01"},
    )
    assert negative.status_code == 422
