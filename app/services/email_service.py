import smtplib
import ssl
from email.message import EmailMessage
from urllib.parse import quote

from app.core.config import (
    FRONTEND_URL,
    PASSWORD_RESET_MINUTES,
    SMTP_FROM,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USE_TLS,
    SMTP_USER,
)


def is_configured() -> bool:
    return bool(
        SMTP_HOST
        and SMTP_FROM
        and (
            not SMTP_USER
            or (SMTP_PASSWORD and SMTP_USE_TLS)
        )
    )

def send_password_reset_email(recipient: str, token: str) -> None:
    if not is_configured():
        raise RuntimeError("Password reset email delivery is not configured")

    message = EmailMessage()
    message["Subject"] = "Redefinição de senha do LifeOS"
    message["From"] = SMTP_FROM
    message["To"] = recipient
    reset_url = f"{FRONTEND_URL}/reset-password?token={quote(token)}"
    message.set_content(
        "Recebemos uma solicitação para redefinir a senha da sua conta LifeOS.\n\n"
        f"Use este link em até {PASSWORD_RESET_MINUTES} minutos: {reset_url}\n\n"
        "Se você não solicitou a redefinição, ignore esta mensagem."
    )

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
        if SMTP_USE_TLS:
            server.starttls(context=ssl.create_default_context())
        if SMTP_USER:
            server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(message)
