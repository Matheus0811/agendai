"""Funções auxiliares usadas em várias rotas."""
import re
import unicodedata
from datetime import time
from typing import TypeVar

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Business, BusinessHour

T = TypeVar("T")


def slugify(text: str) -> str:
    """'Barbearia do João!' -> 'barbearia-do-joao'"""
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")
    return slug[:70] or "meu-negocio"


def unique_slug(db: Session, text: str, ignore_business_id: int | None = None) -> str:
    base = slugify(text)
    candidate, counter = base, 2
    while True:
        existing = db.scalar(select(Business).where(Business.slug == candidate))
        if existing is None or existing.id == ignore_business_id:
            return candidate
        candidate = f"{base}-{counter}"
        counter += 1


def default_hours() -> list[BusinessHour]:
    """Segunda a sexta 9h–19h (almoço 12h–13h), sábado 9h–14h, domingo fechado."""
    hours = []
    for weekday in range(7):
        if weekday < 5:
            hours.append(
                BusinessHour(
                    weekday=weekday,
                    is_open=True,
                    opens_at=time(9, 0),
                    closes_at=time(19, 0),
                    break_start=time(12, 0),
                    break_end=time(13, 0),
                )
            )
        elif weekday == 5:
            hours.append(BusinessHour(weekday=weekday, is_open=True, opens_at=time(9, 0), closes_at=time(14, 0)))
        else:
            hours.append(BusinessHour(weekday=weekday, is_open=False, opens_at=time(9, 0), closes_at=time(18, 0)))
    return hours


def get_owned_or_404(db: Session, model: type[T], object_id: int, business_id: int, label: str = "Registro") -> T:
    """Busca um registro garantindo que ele pertence ao negócio logado."""
    obj = db.get(model, object_id)
    if obj is None or getattr(obj, "business_id", None) != business_id:
        raise HTTPException(status_code=404, detail=f"{label} não encontrado.")
    return obj
