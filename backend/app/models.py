"""Modelos do banco de dados.

Horários de agendamento são guardados como datetime "local" (sem fuso),
no fuso horário configurado para o negócio (Business.timezone).
"""
from datetime import datetime, time
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    Time,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

APPOINTMENT_STATUSES = ("confirmed", "completed", "cancelled", "no_show")

professional_services = Table(
    "professional_services",
    Base.metadata,
    Column("professional_id", ForeignKey("professionals.id", ondelete="CASCADE"), primary_key=True),
    Column("service_id", ForeignKey("services.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    business: Mapped[Optional["Business"]] = relationship(back_populates="owner", uselist=False)


class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(60), default="Barbearia")
    description: Mapped[str] = mapped_column(Text, default="")
    phone: Mapped[str] = mapped_column(String(20), default="")
    whatsapp: Mapped[str] = mapped_column(String(20), default="")
    instagram: Mapped[str] = mapped_column(String(60), default="")
    address: Mapped[str] = mapped_column(String(255), default="")
    city: Mapped[str] = mapped_column(String(120), default="")
    primary_color: Mapped[str] = mapped_column(String(9), default="#6D5AE6")
    timezone: Mapped[str] = mapped_column(String(60), default="America/Sao_Paulo")
    slot_interval_minutes: Mapped[int] = mapped_column(Integer, default=30)
    min_advance_minutes: Mapped[int] = mapped_column(Integer, default=60)
    max_days_ahead: Mapped[int] = mapped_column(Integer, default=30)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    owner: Mapped[User] = relationship(back_populates="business")
    hours: Mapped[list["BusinessHour"]] = relationship(
        back_populates="business", cascade="all, delete-orphan", order_by="BusinessHour.weekday"
    )
    services: Mapped[list["Service"]] = relationship(
        back_populates="business", cascade="all, delete-orphan", order_by="Service.name"
    )
    professionals: Mapped[list["Professional"]] = relationship(
        back_populates="business", cascade="all, delete-orphan", order_by="Professional.name"
    )
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="business", cascade="all, delete-orphan")
    time_offs: Mapped[list["TimeOff"]] = relationship(back_populates="business", cascade="all, delete-orphan")


class BusinessHour(Base):
    """Horário de funcionamento de um dia da semana (0 = segunda ... 6 = domingo)."""

    __tablename__ = "business_hours"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    weekday: Mapped[int] = mapped_column(Integer)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    opens_at: Mapped[time] = mapped_column(Time, default=time(9, 0))
    closes_at: Mapped[time] = mapped_column(Time, default=time(18, 0))
    break_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    break_end: Mapped[time | None] = mapped_column(Time, nullable=True)

    business: Mapped[Business] = relationship(back_populates="hours")


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    price_cents: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    business: Mapped[Business] = relationship(back_populates="services")
    professionals: Mapped[list["Professional"]] = relationship(
        secondary=professional_services, back_populates="services"
    )


class Professional(Base):
    __tablename__ = "professionals"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(120), default="")
    color: Mapped[str] = mapped_column(String(9), default="#6D5AE6")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    business: Mapped[Business] = relationship(back_populates="professionals")
    services: Mapped[list[Service]] = relationship(secondary=professional_services, back_populates="professionals")

    @property
    def service_ids(self) -> list[int]:
        return [service.id for service in self.services]


class TimeOff(Base):
    """Bloqueio de agenda (folga, feriado, férias). professional_id nulo = negócio inteiro."""

    __tablename__ = "time_offs"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    professional_id: Mapped[int | None] = mapped_column(
        ForeignKey("professionals.id", ondelete="CASCADE"), nullable=True
    )
    start_at: Mapped[datetime] = mapped_column(DateTime)
    end_at: Mapped[datetime] = mapped_column(DateTime)
    reason: Mapped[str] = mapped_column(String(160), default="")

    business: Mapped[Business] = relationship(back_populates="time_offs")
    professional: Mapped[Professional | None] = relationship()


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), index=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"))
    professional_id: Mapped[int] = mapped_column(ForeignKey("professionals.id"))
    customer_name: Mapped[str] = mapped_column(String(120))
    customer_phone: Mapped[str] = mapped_column(String(20), index=True)
    customer_email: Mapped[str] = mapped_column(String(255), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    start_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime)
    price_cents: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="confirmed", index=True)
    source: Mapped[str] = mapped_column(String(20), default="online")  # online | manual
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    business: Mapped[Business] = relationship(back_populates="appointments")
    service: Mapped[Service] = relationship()
    professional: Mapped[Professional] = relationship()

    @property
    def service_name(self) -> str:
        return self.service.name if self.service else ""

    @property
    def professional_name(self) -> str:
        return self.professional.name if self.professional else ""

    @property
    def professional_color(self) -> str:
        return self.professional.color if self.professional else "#6D5AE6"
