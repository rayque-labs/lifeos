import logging
import smtplib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.schemas.user import (
    MessageResponse, PasswordChange, PasswordResetConfirm, PasswordResetRequest,
    TokenResponse, UserCreate, UserLogin, UserResponse, UserUpdate,
)
from app.services import auth_service, email_service

router = APIRouter(prefix="/auth", tags=["Authentication"])
bearer_scheme = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    user = auth_service.get_user_from_token(db, credentials.credentials) if credentials else None
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired credentials",
                            headers={"WWW-Authenticate": "Bearer"})
    return user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    user = User(email=payload.email, full_name=payload.full_name,
                password_hash=auth_service.hash_password(payload.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Account already exists") from None
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = auth_service.get_user_by_email(db, payload.email)
    if user is None or not auth_service.verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password",
                            headers={"WWW-Authenticate": "Bearer"})
    return TokenResponse(access_token=auth_service.create_access_token(user),
                         expires_in=auth_service.ACCESS_TOKEN_MINUTES * 60)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.token_version += 1
    db.commit()


@router.get("/me", response_model=UserResponse)
def get_profile(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserResponse)
def update_profile(payload: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.full_name = payload.full_name
    db.commit()
    db.refresh(user)
    return user


@router.put("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(payload: PasswordChange, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not auth_service.verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    user.password_hash = auth_service.hash_password(payload.new_password)
    user.token_version += 1
    db.commit()


@router.post("/password-reset/request", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED)
def request_password_reset(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    if not email_service.is_configured():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="Password recovery is not configured")

    user = auth_service.get_user_by_email(db, payload.email)
    if user is not None:
        raw_token = auth_service.create_password_reset(db, user)
        try:
            email_service.send_password_reset_email(user.email, raw_token)
        except (OSError, RuntimeError, smtplib.SMTPException) as exc:
            reset = auth_service.get_password_reset(db, raw_token)
            if reset is not None:
                reset.consumed_at = datetime.now(timezone.utc)
                db.commit()
            logger.error("Password reset email delivery failed (%s)", type(exc).__name__)

    return MessageResponse(message="If the account exists, password reset instructions were sent.")


@router.post("/password-reset/confirm", response_model=MessageResponse)
def confirm_password_reset(payload: PasswordResetConfirm, db: Session = Depends(get_db)):
    reset = auth_service.consume_password_reset(db, payload.token)

    if reset is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    try:
        user = db.get(User, reset.user_id)

        if user is None:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token",
            )

        user.password_hash = auth_service.hash_password(payload.new_password)
        user.token_version += 1
        db.commit()

    except Exception:
        db.rollback()
        raise

    return MessageResponse(message="Password was updated. Please sign in again.")
