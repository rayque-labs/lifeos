"""Local-only opt-in voice synthesis using Coqui XTTS-v2.

Start with: uvicorn app:app --host 127.0.0.1 --port 8766
The model downloads on first use. Requires a compatible Python/Torch setup.
"""
from __future__ import annotations

import hmac
import io
import ipaddress
import logging
import os
import tempfile
from pathlib import Path
from threading import Lock

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

app = FastAPI(title="LifeOS Voice Lab", docs_url="/docs")
origins = [
    value.strip()
    for value in os.getenv("LIFEOS_VOICE_ORIGINS", "https://localhost,http://localhost").split(",")
    if value.strip() and value.strip() != "*"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)
_model = None
_synthesis_lock = Lock()
_log = logging.getLogger(__name__)
MAX_UPLOAD = 10 * 1024 * 1024
MAX_TEXT = 350


def get_model():
    global _model
    if _model is None:
        from TTS.api import TTS
        _model = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=os.getenv("LIFEOS_VOICE_GPU") == "1")
    return _model


@app.get("/health")
def health():
    return {"status": "ok", "engine": "xtts_v2", "loaded": _model is not None}


def authorize(request: Request):
    origin = request.headers.get("Origin")
    if origin is not None and origin not in origins:
        raise HTTPException(403, "Origem não permitida pelo servidor de voz.")
    token = os.getenv("LIFEOS_VOICE_TOKEN", "")
    if token:
        supplied = request.headers.get("Authorization", "")
        if not hmac.compare_digest(supplied.encode(), f"Bearer {token}".encode()):
            raise HTTPException(401, "Token do servidor de voz inválido.")
        return
    try:
        if request.client and ipaddress.ip_address(request.client.host).is_loopback:
            return
    except ValueError:
        pass
    raise HTTPException(403, "O clonador precisa de um token para acesso fora do computador.")


def synthesize(blob: bytes, text: str) -> bytes:
    if not _synthesis_lock.acquire(blocking=False):
        raise HTTPException(429, "O clonador está ocupado. Tente novamente em alguns segundos.")
    try:
        with tempfile.TemporaryDirectory(prefix="lifeos-voice-") as folder:
            sample = Path(folder) / "reference.wav"
            output = Path(folder) / "generated.wav"
            sample.write_bytes(blob)
            try:
                get_model().tts_to_file(text=text, speaker_wav=str(sample), language="pt", file_path=str(output))
                return output.read_bytes()
            except Exception as exc:
                _log.exception("Falha no motor XTTS-v2")
                raise HTTPException(503, "Falha ao sintetizar áudio; confira instalação e logs locais.") from exc
    finally:
        _synthesis_lock.release()


@app.post("/preview", dependencies=[Depends(authorize)])
async def preview(
    audio: UploadFile = File(...),
    text: str = Form(...),
    permission_confirmed: bool = Form(False),
):
    """Generate new Portuguese speech from an authorized reference recording.

    No speaker profile or upload is retained after synthesis.
    """
    if not permission_confirmed:
        raise HTTPException(403, "Confirme que a voz é sua ou que você tem autorização expressa para utilizá-la.")
    text = text.strip()
    if not text or len(text) > MAX_TEXT:
        raise HTTPException(422, f"Texto deve ter entre 1 e {MAX_TEXT} caracteres.")
    if audio.content_type not in ("audio/wav", "audio/x-wav", "audio/wave"):
        raise HTTPException(415, "Envie áudio WAV (mono, fala limpa, sem música).")
    blob = await audio.read(MAX_UPLOAD + 1)
    if len(blob) > MAX_UPLOAD:
        raise HTTPException(413, "Áudio excede 10 MB.")
    if len(blob) < 1024:
        raise HTTPException(422, "Áudio muito pequeno.")

    # Validate WAV structure before passing to the synthesis engine.
    import wave
    try:
        with wave.open(io.BytesIO(blob), "rb") as wav:
            duration = wav.getnframes() / wav.getframerate()
            if not 3 <= duration <= 30 or wav.getnchannels() not in (1, 2):
                raise HTTPException(422, "Use uma gravação de 3 a 30 segundos, com 1 ou 2 canais.")
    except (wave.Error, ZeroDivisionError, EOFError):
        raise HTTPException(422, "Arquivo WAV inválido.")

    content = await run_in_threadpool(synthesize, blob, text)
    return Response(content=content, media_type="audio/wav", headers={"Cache-Control": "no-store"})
