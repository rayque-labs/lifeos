"""Read-only gateway for the LifeOS owner's pre-authorized Pluggy Open Finance items."""
from __future__ import annotations

import hmac
import math
import os
from collections.abc import Iterator
from datetime import date, timedelta
from uuid import UUID

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="LifeOS Open Finance", docs_url=None, redoc_url=None, openapi_url=None)
origins = [
    origin.strip()
    for origin in os.getenv("LIFEOS_BANK_ORIGINS", "https://localhost,http://localhost").split(",")
    if origin.strip() and origin.strip() != "*"
]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET"], allow_headers=["Authorization"])


def authorize(request: Request) -> None:
    token = os.getenv("LIFEOS_BANK_TOKEN", "")
    if not token:
        raise HTTPException(503, "Servidor financeiro sem token de leitura configurado.")
    if not hmac.compare_digest(request.headers.get("Authorization", "").encode(), f"Bearer {token}".encode()):
        raise HTTPException(401, "Token de leitura inválido.")


def provider() -> Iterator[httpx.Client]:
    with httpx.Client(base_url="https://api.pluggy.ai", timeout=8, follow_redirects=False) as client:
        yield client


def upstream(client: httpx.Client, method: str, path: str, **kwargs) -> dict:
    data = client.request(method, path, **kwargs)
    data.raise_for_status()
    result = data.json()
    if not isinstance(result, dict):
        raise ValueError("Resposta do provedor inválida")
    return result


def financial_number(value: object) -> float | None:
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
        return None
    return float(value)


def currency(value: object) -> str:
    return value if isinstance(value, str) and len(value) == 3 and value.isascii() and value.isalpha() else "BRL"


@app.get("/open-finance/snapshot", dependencies=[Depends(authorize)])
def snapshot(response: Response, client: httpx.Client = Depends(provider)) -> dict:
    client_id = os.getenv("PLUGGY_CLIENT_ID", "")
    client_secret = os.getenv("PLUGGY_CLIENT_SECRET", "")
    configured = os.getenv("PLUGGY_OPEN_FINANCE_ITEM_IDS", "")
    if not (client_id and client_secret and configured.strip()):
        raise HTTPException(503, "Configure as credenciais e uma conexão autorizada do Open Finance no servidor.")

    try:
        items = list(dict.fromkeys(str(UUID(value.strip())) for value in configured.split(",") if value.strip()))
    except ValueError as error:
        raise HTTPException(503, "Identificador de conexão inválido no servidor.") from error
    if len(items) > 5:
        raise HTTPException(503, "Configure até cinco conexões para consulta.")

    accounts: list[dict] = []
    transactions: list[dict] = []
    try:
        auth = upstream(client, "POST", "/auth", json={"clientId": client_id, "clientSecret": client_secret})
        headers = {"X-API-KEY": auth["apiKey"]}
        since = (date.today() - timedelta(days=30)).isoformat()
        for item_id in items:
            item = upstream(client, "GET", f"/items/{item_id}", headers=headers)
            if item.get("connector", {}).get("isOpenFinance") is not True:
                raise HTTPException(422, "A conexão configurada precisa ser do Open Finance regulado.")
            if item.get("status") != "UPDATED":
                raise HTTPException(409, "A conexão bancária ainda não está disponível. Confira o consentimento no provedor.")
            results = upstream(client, "GET", "/accounts", headers=headers, params={"itemId": item_id})["results"]
            for raw in results:
                account_id = str(UUID(raw["id"]))
                cur = currency(raw.get("currencyCode"))
                accounts.append({
                    "id": account_id,
                    "name": str(raw.get("name") or "Conta")[:100],
                    "balance": financial_number(raw.get("balance")),
                    "currency": cur,
                })
                movements = upstream(client, "GET", "/transactions", headers=headers, params={
                    "accountId": account_id, "from": since, "pageSize": 30,
                })["results"]
                for entry in movements:
                    amount = financial_number(entry.get("amount"))
                    if amount is not None:
                        transactions.append({
                            "id": str(entry["id"]),
                            "description": str(entry.get("description") or "Lançamento")[:160],
                            "amount": amount,
                            "currency": currency(entry.get("currencyCode") or cur),
                            "date": str(entry["date"]),
                        })
    except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError) as error:
        raise HTTPException(502, "O provedor financeiro não retornou dados válidos.") from error
    response.headers["Cache-Control"] = "no-store"
    return {
        "accounts": accounts,
        "transactions": sorted(transactions, key=lambda entry: entry["date"], reverse=True)[:60],
    }
