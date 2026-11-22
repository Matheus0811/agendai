"""A demo se renova sozinha a cada 24 horas, para as datas acompanharem o dia de hoje."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, update

from app.database import SessionLocal
from app.models import Appointment, User
from app.seed import DEMO_EMAIL, refresh_demo_if_needed


def agora_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def demo_criada_em() -> datetime:
    with SessionLocal() as db:
        return db.scalar(select(User.created_at).where(User.email == DEMO_EMAIL))


def test_demo_tem_agenda_nos_proximos_dias():
    refresh_demo_if_needed()
    with SessionLocal() as db:
        ultimo = db.scalar(select(func.max(Appointment.start_at)))
    assert ultimo.date() >= (agora_utc() + timedelta(days=5)).date()


def test_demo_recente_nao_e_recriada_e_demo_velha_e():
    refresh_demo_if_needed()
    marca = agora_utc() - timedelta(hours=2)
    with SessionLocal() as db:
        db.execute(update(User).where(User.email == DEMO_EMAIL).values(created_at=marca))
        db.commit()

    refresh_demo_if_needed()  # 2 horas: continua a mesma
    assert demo_criada_em() == marca

    velha = agora_utc() - timedelta(days=2)
    with SessionLocal() as db:
        db.execute(update(User).where(User.email == DEMO_EMAIL).values(created_at=velha))
        db.commit()

    refresh_demo_if_needed()  # 2 dias: recriada com a data de agora
    assert demo_criada_em() > agora_utc() - timedelta(minutes=5)
