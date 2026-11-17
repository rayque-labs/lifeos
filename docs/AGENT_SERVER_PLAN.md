# LifeOS independent agent: delivery plan

## Product boundary
LifeOS is a user-facing product. Its agent is **not Souza**; each person can name it. User data and memory must be isolated by authenticated account.

## Delivery phases
1. Validate final Android APK (navigation, alarms, safe areas, offline persistence, permissions).
2. Local lab: Android Termux + llama.cpp on a spare phone, or a Linux computer. Benchmark 0.5B-1B quantized models before selecting hardware. No public internet exposure.
3. Secure gateway: JWT validation against LifeOS identity provider, per-user storage, request limits, TLS, revocable device tokens and audit logs.
4. LLM: local OpenAI-compatible inference; cloud fallback only with explicit user opt-in for the selected data.
5. Agent: memory with deletion/export, contextual planning, controlled proactive notifications, cooldown and quiet hours.
6. Connectors: OAuth read-only scopes first. Open Finance only via compliant authorized provider and explicit consent. No credentials stored in APK.
7. Approval: proposed action with exact parameters, risk, expiry and hash; user confirmation; server-side verification; idempotency; audit; separate payment-provider authentication where required.
8. Production: move proprietary server to private repository and deploy separately. Public repo contains only client and API contracts.

## Security invariant
A model cannot authorize its own tool calls. Device preference toggles do not grant Android permissions, OAuth scopes or financial access. No covert retrieval of deleted messages; only data exposed by user-authorized integrations, respecting privacy.
