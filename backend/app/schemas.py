"""Schemas (Pydantic) de entrada e saída da API."""
import re
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

AppointmentStatus = Literal["confirmed", "completed", "cancelled", "no_show"]

HEX_COLOR = r"^#[0-9a-fA-F]{6}$"
SLUG = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


def only_digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Autenticação ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)
    business_name: str = Field(min_length=2, max_length=120)
    category: str = Field(default="Barbearia", max_length=60)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


# ---------- Negócio ----------
class BusinessOut(ORMModel):
    id: int
    name: str
    slug: str
    category: str
    description: str
    phone: str
    whatsapp: str
    instagram: str
    address: str
    city: str
    primary_color: str
    timezone: str
    slot_interval_minutes: int
    min_advance_minutes: int
    max_days_ahead: int


class BusinessUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=3, max_length=80, pattern=SLUG)
    category: str = Field(default="", max_length=60)
    description: str = Field(default="", max_length=1000)
    phone: str = Field(default="", max_length=20)
    whatsapp: str = Field(default="", max_length=20)
    instagram: str = Field(default="", max_length=60)
    address: str = Field(default="", max_length=255)
    city: str = Field(default="", max_length=120)
    primary_color: str = Field(default="#6D5AE6", pattern=HEX_COLOR)
    slot_interval_minutes: int = Field(default=30, ge=5, le=240)
    min_advance_minutes: int = Field(default=60, ge=0, le=60 * 24 * 7)
    max_days_ahead: int = Field(default=30, ge=1, le=180)

    @field_validator("phone", "whatsapp")
    @classmethod
    def _digits(cls, value: str) -> str:
        return only_digits(value)

    @field_validator("instagram")
    @classmethod
    def _instagram(cls, value: str) -> str:
        return value.strip().lstrip("@")


class UserOut(ORMModel):
    id: int
    name: str
    email: str


class MeOut(UserOut):
    business: BusinessOut | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: MeOut


class BusinessHourIn(BaseModel):
    weekday: int = Field(ge=0, le=6)
    is_open: bool = True
    opens_at: time = time(9, 0)
    closes_at: time = time(18, 0)
    break_start: time | None = None
    break_end: time | None = None

    @model_validator(mode="after")
    def _check_times(self) -> "BusinessHourIn":
        if not self.is_open:
            return self
        if self.opens_at >= self.closes_at:
            raise ValueError("O horário de abertura deve ser antes do fechamento.")
        if (self.break_start is None) != (self.break_end is None):
            raise ValueError("Informe início e fim do intervalo, ou deixe os dois vazios.")
        if self.break_start and self.break_end:
            if not (self.opens_at <= self.break_start < self.break_end <= self.closes_at):
                raise ValueError("O intervalo deve estar dentro do horário de funcionamento.")
        return self


class BusinessHourOut(ORMModel):
    weekday: int
    is_open: bool
    opens_at: time
    closes_at: time
    break_start: time | None
    break_end: time | None


# ---------- Serviços ----------
class ServiceIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=500)
    duration_minutes: int = Field(ge=5, le=480)
    price_cents: int = Field(ge=0, le=100_000_00)
    is_active: bool = True
    professional_ids: list[int] | None = None


class ServiceOut(ORMModel):
    id: int
    name: str
    description: str
    duration_minutes: int
    price_cents: int
    is_active: bool


# ---------- Profissionais ----------
class ProfessionalIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    role: str = Field(default="", max_length=120)
    color: str = Field(default="#6D5AE6", pattern=HEX_COLOR)
    is_active: bool = True
    service_ids: list[int] = []


class ProfessionalOut(ORMModel):
    id: int
    name: str
    role: str
    color: str
    is_active: bool
    service_ids: list[int]


# ---------- Bloqueios ----------
class TimeOffIn(BaseModel):
    professional_id: int | None = None
    start_at: datetime
    end_at: datetime
    reason: str = Field(default="", max_length=160)

    @model_validator(mode="after")
    def _check_range(self) -> "TimeOffIn":
        if self.end_at <= self.start_at:
            raise ValueError("O fim do bloqueio deve ser depois do início.")
        return self


class TimeOffOut(ORMModel):
    id: int
    professional_id: int | None
    start_at: datetime
    end_at: datetime
    reason: str


# ---------- Agendamentos ----------
class BookingIn(BaseModel):
    service_id: int
    professional_id: int | None = None
    date: date
    time: time
    customer_name: str = Field(min_length=2, max_length=120)
    customer_phone: str = Field(min_length=10, max_length=20)
    customer_email: EmailStr | None = None
    notes: str = Field(default="", max_length=500)

    @field_validator("customer_phone")
    @classmethod
    def _phone(cls, value: str) -> str:
        digits = only_digits(value)
        if not 10 <= len(digits) <= 13:
            raise ValueError("Telefone inválido. Use DDD + número.")
        return digits

    @field_validator("customer_name")
    @classmethod
    def _name(cls, value: str) -> str:
        return " ".join(value.split())


class AppointmentOut(ORMModel):
    id: int
    code: str
    service_id: int
    service_name: str
    professional_id: int
    professional_name: str
    professional_color: str
    customer_name: str
    customer_phone: str
    customer_email: str
    notes: str
    start_at: datetime
    end_at: datetime
    price_cents: int
    status: str
    source: str
    created_at: datetime | None = None


class StatusUpdate(BaseModel):
    status: AppointmentStatus


class PublicAppointmentOut(BaseModel):
    code: str
    status: str
    service_name: str
    professional_name: str
    start_at: datetime
    end_at: datetime
    price_cents: int
    customer_name: str
    can_cancel: bool
    business: "PublicBusinessSummary"


class PublicBusinessSummary(BaseModel):
    name: str
    slug: str
    phone: str
    whatsapp: str
    address: str
    city: str
    primary_color: str


# ---------- Página pública ----------
class PublicProfessional(ORMModel):
    id: int
    name: str
    role: str
    color: str
    service_ids: list[int]


class PublicBusinessOut(BaseModel):
    name: str
    slug: str
    category: str
    description: str
    phone: str
    whatsapp: str
    instagram: str
    address: str
    city: str
    primary_color: str
    max_days_ahead: int
    hours: list[BusinessHourOut]
    services: list[ServiceOut]
    professionals: list[PublicProfessional]


class AvailabilityOut(BaseModel):
    date: date
    times: list[str]


class CalendarDay(BaseModel):
    date: date
    available: bool
    slots: int


class CalendarOut(BaseModel):
    days: list[CalendarDay]


# ---------- Clientes ----------
class CustomerOut(BaseModel):
    name: str
    phone: str
    email: str
    visits: int
    completed: int
    cancelled: int
    total_spent_cents: int
    first_visit: datetime | None
    last_visit: datetime | None
    next_visit: datetime | None


# ---------- Dashboard ----------
class DailyPoint(BaseModel):
    date: date
    appointments: int
    revenue_cents: int


class TopService(BaseModel):
    name: str
    count: int
    revenue_cents: int


class DashboardOut(BaseModel):
    today_total: int
    today_remaining: int
    today_completed: int
    month_revenue_cents: int
    month_expected_cents: int
    previous_month_revenue_cents: int
    month_appointments: int
    cancellation_rate: float
    new_customers_month: int
    average_ticket_cents: int
    daily: list[DailyPoint]
    top_services: list[TopService]
    upcoming: list[AppointmentOut]


PublicAppointmentOut.model_rebuild()
