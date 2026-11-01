import pytest

from app.services import email_service


@pytest.mark.parametrize(
    "smtp_user,smtp_password,smtp_tls,expected",
    [
        ("", "", False, True),
        ("usuario", "senha", True, True),
        ("usuario", "senha", False, False),
        ("usuario", "", True, False),
    ],
)
def test_is_configured_requires_tls_for_authenticated_smtp(
    monkeypatch,
    smtp_user,
    smtp_password,
    smtp_tls,
    expected,
):
    monkeypatch.setattr(email_service, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(email_service, "SMTP_FROM", "lifeos@example.com")
    monkeypatch.setattr(email_service, "SMTP_USER", smtp_user)
    monkeypatch.setattr(email_service, "SMTP_PASSWORD", smtp_password)
    monkeypatch.setattr(email_service, "SMTP_USE_TLS", smtp_tls)

    assert email_service.is_configured() is expected
