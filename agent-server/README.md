# LifeOS Agent Server (experimental)

Independent agent service. This folder contains **source code only**, never a deployed server, credentials, model weights, financial data or private memories.

## Development
Python 3.12+:
```sh
cd agent-server
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app:app --host 127.0.0.1 --port 8765
```

Local health: GET /health. POST /v1/chat is disabled until authentication and per-user isolation are integrated; it deliberately returns 503. Never expose port 8765 publicly.

## Planned architecture
- Android: perception and preferences on-device; never silently upload notification content.
- Gateway: authenticate user and device, rate-limit, enforce consent and data scopes.
- Agent: LLM adapter (llama.cpp OpenAI-compatible API, optional cloud fallback), per-user memory, contextual dialogue.
- Tools: read-only by default; sensitive writes require server-side one-time approval of immutable action details, expiry and audit trail.
- Deployment: own private infrastructure/repository for production; public LifeOS APK only gets the gateway URL, not credentials or server implementation.

Removing server source from the public repository later **does not erase Git history**. If the service becomes proprietary, move it to a private repository before adding private implementation details. Never commit secrets, even temporarily.

No external bank, email or message connector is implemented in this scaffold.
