# API

OpenAPI interativo: `/docs`; schema: `/openapi.json`. JSON request/response encoding uses UTF-8. Authenticated routes require `Authorization: Bearer <access_token>`.

## Authentication

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | Create an account; password must contain 12–128 characters. |
| `POST` | `/auth/login` | Public | Return an expiring bearer token. |
| `POST` | `/auth/logout` | Authenticated | Revoke the account's current tokens. |
| `GET` | `/auth/me` | Authenticated | Read the current profile. |
| `PATCH` | `/auth/me` | Authenticated | Update the display name. |
| `PUT` | `/auth/password` | Authenticated | Change password and revoke existing tokens. |
| `POST` | `/auth/password-reset/request` | Public | Send a single-use reset link to a configured SMTP service. |
| `POST` | `/auth/password-reset/confirm` | Public | Consume an unexpired reset token and set a new password. |

Passwords are hashed with Argon2 through `pwdlib`; API responses never include the hash. Login accepts JSON `{ "email": "...", "password": "..." }`. Reset request returns the same response for registered and unregistered addresses. Tokens are hashed at rest, expire, and can be consumed once. SMTP must be configured or the request endpoint returns `503` before examining the email address.

## Tasks

All task routes require authentication and only return or modify records owned by the current user. A record owned by another account is reported as `404`.

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/tasks/` | Create a task. |
| `GET` | `/tasks/` | List the current user's tasks. |
| `GET` | `/tasks/{task_id}` | Read an owned task. |
| `PUT` | `/tasks/{task_id}` | Update an owned task. |
| `PATCH` | `/tasks/{task_id}` | Partially update an owned task. |
| `DELETE` | `/tasks/{task_id}` | Delete an owned task. |

Task fields include title, description, priority, category, timezone-aware due date, status (`pending`, `in_progress`, `completed`), and recurrence (`none`, `daily`, `weekly`, `monthly`). A recurring task requires a due date. Completing it preserves the completed occurrence and creates its next occurrence. List filters include `status`, `priority`, `category`, `q`, `due_before`, and `due_after`; sort fields include `created_at`, `due_at`, `priority`, `title`, and `status`, with `sort_order=asc|desc`.

## Projects

All project routes require authentication and enforce ownership. `GET /projects/?status=active` filters by `active`, `paused`, `completed`, or `archived`. Each project response calculates task count, completed count, and completion percentage from its own linked tasks. Tasks can only link to a project owned by the same user; deleting a project leaves its tasks and unlinks them.

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/projects/` | Create a project and objective. |
| `GET` | `/projects/` | List own projects with live progress. |
| `GET` | `/projects/{project_id}` | Read an owned project. |
| `PATCH` | `/projects/{project_id}` | Update an owned project. |
| `DELETE` | `/projects/{project_id}` | Delete an owned project and detach its tasks. |

## Habits

Habit routes are private. Frequency is `daily` (seven expected days per week) or `weekly` with a target from one to seven. A check-in is unique per habit/date; repeating the request updates its note instead of duplicating history. Dates and streaks use UTC because per-user time zones are not yet part of account settings. Consistency is the percentage of target check-ins achieved in the last 30 days.

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/habits/` | Create a habit. |
| `GET` | `/habits/` | List own habits and real streak/consistency metrics. |
| `GET` | `/habits/{habit_id}` | Read a habit and its metrics. |
| `PATCH` | `/habits/{habit_id}` | Update a habit. |
| `DELETE` | `/habits/{habit_id}` | Delete a habit and its check-ins. |
| `POST` | `/habits/{habit_id}/logs` | Record or update one check-in. |
| `GET` | `/habits/{habit_id}/logs` | Read history; optional `from_date` and `to_date`. |
| `DELETE` | `/habits/{habit_id}/logs/{log_id}` | Delete one owned check-in. |

## Notes

Notes are private and support title/content search, category, normalized tags, pinning, and pagination (`limit` up to 100, `offset`).

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/notes/` | Create a note. |
| `GET` | `/notes/` | Search and filter own notes. |
| `GET` | `/notes/{note_id}` | Read a note. |
| `PATCH` | `/notes/{note_id}` | Update a note. |
| `DELETE` | `/notes/{note_id}` | Delete a note. |

## Calendar

Calendar routes use ISO-8601 timestamps with time zones. `GET /calendar/events/` accepts `starts_after` (inclusive) and `starts_before` (exclusive) to load ranges for week/month views. Events may link an owned task; an event cannot link to another user's task.

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/calendar/events/` | Create an event. |
| `GET` | `/calendar/events/` | List events in an optional date range. |
| `GET` | `/calendar/events/{event_id}` | Read an event. |
| `PATCH` | `/calendar/events/{event_id}` | Update an event. |
| `DELETE` | `/calendar/events/{event_id}` | Delete an event. |

## Personal finance

All finance routes are private. Amounts are validated to two decimal places and are calculated/stored with `Decimal`/`NUMERIC(14,2)`. Account balances include opening balance plus income minus expenses. Reports keep each currency separate; LifeOS does not exchange or convert currencies. An account with transaction history cannot be deleted, preserving the ledger. Category deletion keeps transactions and marks their category as uncategorized.

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/finance/accounts` | Create a currency account. |
| `GET` | `/finance/accounts` | List accounts with calculated balances. |
| `PATCH` | `/finance/accounts/{account_id}` | Rename account or change opening balance. |
| `DELETE` | `/finance/accounts/{account_id}` | Delete only an account without transactions. |
| `POST` | `/finance/categories` | Create an income or expense category. |
| `GET` | `/finance/categories` | List own categories. |
| `DELETE` | `/finance/categories/{category_id}` | Delete a category without deleting transactions. |
| `POST` | `/finance/transactions` | Create an income or expense transaction. |
| `GET` | `/finance/transactions` | List/filter transactions by account, category, type, and date. |
| `PATCH` | `/finance/transactions/{transaction_id}` | Edit an owned transaction. |
| `DELETE` | `/finance/transactions/{transaction_id}` | Delete an owned transaction. |
| `GET` | `/finance/summary/monthly?month=YYYY-MM` | Monthly totals and category breakdown, grouped by currency. |

## Dashboard

`GET /dashboard/` returns counts of own pending/completed/overdue tasks, active-project progress, today's habit check-ins, the next seven days of calendar events, current account balances, and the current month's finance summary. The dashboard response is computed from the persisted domain records for the authenticated user.

## Status codes

`401` means missing, invalid, expired, or revoked credentials; `404` means a task does not exist or is not owned by the caller; `409` means the email is already registered; `422` means request validation failed. Errors use FastAPI's JSON `detail` format.
