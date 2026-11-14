from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import DB, CurrentUser
from app.models import Business, Professional, User
from app.schemas import LoginIn, MeOut, RegisterIn, TokenOut
from app.security import create_access_token, hash_password, verify_password
from app.utils import default_hours, unique_slug

router = APIRouter(prefix="/auth", tags=["Autenticação"])

PROFESSIONAL_COLORS = ["#6D5AE6", "#E6735A", "#2BA87E", "#E0A030", "#3B82F6", "#D9468C"]


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterIn, db: DB):
    """Cria a conta do dono e o negócio dele, já com horários padrão."""
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Já existe uma conta com este e-mail.")

    user = User(name=data.name.strip(), email=email, password_hash=hash_password(data.password))
    business = Business(
        owner=user,
        name=data.business_name.strip(),
        slug=unique_slug(db, data.business_name),
        category=data.category.strip() or "Outro",
        description="",
    )
    business.hours = default_hours()
    business.professionals = [
        Professional(name=data.name.strip(), role="Proprietário(a)", color=PROFESSIONAL_COLORS[0])
    ]

    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenOut(access_token=create_access_token(str(user.id)), user=MeOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: DB):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
    return TokenOut(access_token=create_access_token(str(user.id)), user=MeOut.model_validate(user))


@router.get("/me", response_model=MeOut)
def me(user: CurrentUser):
    return user
