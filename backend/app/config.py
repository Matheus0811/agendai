"""Configurações da aplicação, lidas de variáveis de ambiente (.env)."""
import os

from dotenv import load_dotenv

load_dotenv()


def _normalize_database_url(url: str) -> str:
    # Serviços como Render/Heroku entregam "postgres://", mas o SQLAlchemy
    # espera "postgresql+psycopg://" para usar o driver psycopg 3.
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


class Settings:
    app_name: str = "Agendaí API"
    database_url: str = _normalize_database_url(os.getenv("DATABASE_URL", "sqlite:///./agendai.db"))
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-troque-esta-chave-antes-de-publicar")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    cors_origins: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip()
    ]
    default_timezone: str = os.getenv("DEFAULT_TIMEZONE", "America/Sao_Paulo")
    # Cria a barbearia de demonstração automaticamente ao iniciar (útil no deploy).
    seed_demo: bool = os.getenv("SEED_DEMO", "false").lower() == "true"


settings = Settings()
