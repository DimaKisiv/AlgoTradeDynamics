"""Authentication endpoints: register, login, current user."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.logging import get_logger
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.backtest import BacktestRun
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserLogin, UserResponse
from app.services.auth_service import authenticate, create_user, get_user_by_email

router = APIRouter(prefix="/auth", tags=["Auth"])
logger = get_logger(__name__)


def _to_response(user: User, runs_count: int) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        created_at=user.created_at,
        runs_count=runs_count,
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if get_user_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Користувач з таким email вже існує",
        )
    user = create_user(db, payload.email, payload.password)
    logger.info("New user registered: id=%s", user.id)
    return _to_response(user, 0)


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = authenticate(db, payload.email, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невірний email або пароль",
        )
    return Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    runs_count = (
        db.query(BacktestRun).filter(BacktestRun.user_id == current_user.id).count()
    )
    return _to_response(current_user, runs_count)
