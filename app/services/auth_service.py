import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.config import ACCESS_TOKEN_MINUTES, JWT_SECRET, PASSWORD_RESET_MINUTES
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User

_password_hash = PasswordHash.recommended()
_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _password_hash.verify(password, password_hash)


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": str(user.id), "ver": user.token_version, "iat": now,
         "exp": now + timedelta(minutes=ACCESS_TOKEN_MINUTES)},
        JWT_SECRET,
        algorithm=_ALGORITHM,
    )


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def get_user_from_token(db: Session, token: str) -> User | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[_ALGORITHM])
        user_id = int(payload["sub"])
        token_version = int(payload["ver"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        return None
    user = db.get(User, user_id)
    if user is None or user.token_version != token_version:
        return None
    return user


def create_password_reset(db: Session, user: User) -> str:
    raw_token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
    db.add(PasswordResetToken(
        user_id=user.id,
        token_hash=hashlib.sha256(raw_token.encode()).hexdigest(),
        expires_at=now + timedelta(minutes=PASSWORD_RESET_MINUTES),
        created_at=now,
    ))
    db.commit()
    return raw_token


def get_password_reset(db: Session, raw_token: str) -> PasswordResetToken | None:
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    return db.scalar(select(PasswordResetToken).where(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.consumed_at.is_(None),
    ))


def consume_password_reset(db: Session, raw_token: str) -> PasswordResetToken | None:
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    result = db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.consumed_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
        .values(consumed_at=now)
    )

    if result.rowcount != 1:
        return None

    return db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash
        )
    )
