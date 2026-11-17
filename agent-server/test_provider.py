"""Manual, local-only provider smoke test. No HTTP endpoint is exposed.

Usage: LIFEOS_LLM_BASE_URL=https://.../v1 LIFEOS_LLM_MODEL=... LIFEOS_LLM_API_KEY=... python test_provider.py
Never commit your key or use real personal data in this test.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse

def main():
    base = os.environ.get("LIFEOS_LLM_BASE_URL", "").rstrip("/")
    model = os.environ.get("LIFEOS_LLM_MODEL", "")
    key = os.environ.get("LIFEOS_LLM_API_KEY", "")
    parsed = urlparse(base)
    is_local = parsed.hostname in ("127.0.0.1", "localhost", "::1")
    if not base or not model or (not key and not is_local):
        sys.exit("Configure LIFEOS_LLM_BASE_URL, LIFEOS_LLM_MODEL and LIFEOS_LLM_API_KEY (except for localhost).")
    if parsed.scheme != "https" and not (parsed.scheme == "http" and is_local):
        sys.exit("Only HTTPS providers or HTTP localhost are supported.")
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Você é uma amiga digital do LifeOS. Fale português brasileiro, com humor leve e sem fingir ser humana. Seja breve."},
            {"role": "user", "content": "Oi! Me lembra de beber água e me anima para estudar hoje."}
        ],
        "max_tokens": 120,
        "temperature": 0.7,
    }
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = "Bearer " + key
    request = urllib.request.Request(base + "/chat/completions", data=json.dumps(payload).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            result = json.load(response)
        print(result["choices"][0]["message"]["content"])
    except (urllib.error.URLError, KeyError, IndexError, ValueError) as exc:
        sys.exit("Falha no teste da API. Confira URL, modelo, cota e credenciais. " + type(exc).__name__)


if __name__ == '__main__':
    main()
