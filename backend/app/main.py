"""Ponto de entrada da API do Agendaí."""
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  (registra as tabelas no metadata)
from app.config import settings
from app.database import Base, engine
from app.routers import appointments, auth, business, catalog, customers, dashboard, public


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    if settings.seed_demo:
        from app.seed import refresh_demo_if_needed

        try:
            refresh_demo_if_needed()
        except Exception:  # outra instância pode estar recriando a demo ao mesmo tempo
            logging.getLogger("agendai").exception("Não foi possível renovar a demo")
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "API do **Agendaí**, sistema de agendamento online para pequenos negócios "
        "(barbearias, salões, clínicas e estúdios).\n\n"
        "Para testar rotas protegidas: faça login em `/api/auth/login`, copie o "
        "`access_token` e clique em **Authorize**."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(business.router)
api.include_router(catalog.router)
api.include_router(appointments.router)
api.include_router(customers.router)
api.include_router(dashboard.router)
api.include_router(public.router)


@api.get("/health", tags=["Status"])
def health():
    return {"status": "ok"}


app.include_router(api)


@app.get("/", include_in_schema=False)
def root():
    return {"name": settings.app_name, "docs": "/docs", "health": "/api/health"}
