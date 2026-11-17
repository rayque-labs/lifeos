"""LifeOS independent agent server: intentionally fail-closed starter."""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="LifeOS Agent", version="0.1.0", docs_url=None, redoc_url=None)

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)

@app.get("/health")
def health():
    return {"status": "ok", "service": "lifeos-agent", "chat_enabled": False}

@app.post("/v1/chat")
def chat(_: ChatRequest):
    # Do not turn this on without verified identity, per-user isolation,
    # explicit data-sharing consent, quotas and abuse protection.
    raise HTTPException(status_code=503, detail="Agent chat disabled pending secure authentication")

@app.post("/v1/actions/execute")
def execute():
    # Approval must be validated on the server, not accepted from client flags.
    raise HTTPException(status_code=403, detail="Action execution disabled")
