"""Regras de agendamento que dependem do banco de dados."""
import secrets
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Appointment, Business, Professional, Service, TimeOff
from app.schemas import BookingIn
from app.services.availability import DayHours, Interval, compute_slots

# Sem letras/números parecidos (0/O, 1/I) para o cliente não se confundir.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

BusyMap = tuple[dict[int, list[Interval]], list[Interval]]


class BookingError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def business_now(business: Business) -> datetime:
    """Data e hora atuais no fuso do negócio (sem tzinfo, igual ao banco)."""
    return datetime.now(ZoneInfo(business.timezone)).replace(tzinfo=None, second=0, microsecond=0)


def day_hours(business: Business, day: date) -> DayHours | None:
    for hour in business.hours:
        if hour.weekday == day.weekday():
            if not hour.is_open:
                return None
            return DayHours(hour.opens_at, hour.closes_at, hour.break_start, hour.break_end)
    return None


def eligible_professionals(
    business: Business, service: Service, professional_id: int | None = None
) -> list[Professional]:
    professionals = [
        professional
        for professional in business.professionals
        if professional.is_active and any(s.id == service.id for s in professional.services)
    ]
    if professional_id is not None:
        professionals = [p for p in professionals if p.id == professional_id]
        if not professionals:
            raise BookingError("Este profissional não realiza o serviço escolhido.")
    return professionals


def load_busy(db: Session, business_id: int, start: datetime, end: datetime) -> BusyMap:
    """Carrega de uma vez tudo que ocupa a agenda no período.

    Retorna (ocupado por profissional, bloqueios do negócio inteiro).
    """
    by_professional: dict[int, list[Interval]] = defaultdict(list)

    appointments = db.execute(
        select(Appointment.professional_id, Appointment.start_at, Appointment.end_at).where(
            Appointment.business_id == business_id,
            Appointment.status != "cancelled",
            Appointment.start_at < end,
            Appointment.end_at > start,
        )
    )
    for professional_id, start_at, end_at in appointments:
        by_professional[professional_id].append((start_at, end_at))

    general: list[Interval] = []
    time_offs = db.scalars(
        select(TimeOff).where(
            TimeOff.business_id == business_id,
            TimeOff.start_at < end,
            TimeOff.end_at > start,
        )
    )
    for time_off in time_offs:
        interval = (time_off.start_at, time_off.end_at)
        if time_off.professional_id is None:
            general.append(interval)
        else:
            by_professional[time_off.professional_id].append(interval)

    return by_professional, general


def _day_range(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min)
    return start, start + timedelta(days=1)


def slots_by_professional(
    db: Session,
    business: Business,
    service: Service,
    day: date,
    professional_id: int | None = None,
    now: datetime | None = None,
    busy: BusyMap | None = None,
    respect_advance: bool = True,
) -> dict[datetime, list[int]]:
    """Mapeia cada horário livre para os profissionais disponíveis nele."""
    hours = day_hours(business, day)
    if hours is None:
        return {}

    professionals = eligible_professionals(business, service, professional_id)
    if busy is None:
        busy = load_busy(db, business.id, *_day_range(day))
    by_professional, general = busy

    if respect_advance:
        reference_now = now or business_now(business)
        advance = business.min_advance_minutes
    else:
        reference_now, advance = None, 0

    result: dict[datetime, list[int]] = defaultdict(list)
    for professional in professionals:
        slots = compute_slots(
            day=day,
            hours=hours,
            duration_minutes=service.duration_minutes,
            interval_minutes=business.slot_interval_minutes,
            busy=by_professional.get(professional.id, []) + general,
            now=reference_now,
            min_advance_minutes=advance,
        )
        for slot in slots:
            result[slot].append(professional.id)
    return dict(sorted(result.items()))


def check_date_window(business: Business, day: date, now: datetime) -> None:
    today = now.date()
    if day < today:
        raise BookingError("Não é possível agendar em uma data que já passou.")
    if day > today + timedelta(days=business.max_days_ahead):
        raise BookingError(f"A agenda está aberta apenas para os próximos {business.max_days_ahead} dias.")


def available_times(
    db: Session, business: Business, service: Service, day: date, professional_id: int | None = None
) -> list[str]:
    now = business_now(business)
    try:
        check_date_window(business, day, now)
    except BookingError:
        return []
    slots = slots_by_professional(db, business, service, day, professional_id, now=now)
    return [slot.strftime("%H:%M") for slot in slots]


def availability_calendar(
    db: Session, business: Business, service: Service, professional_id: int | None = None
) -> list[tuple[date, int]]:
    """Quantidade de horários livres em cada dia da janela de agendamento."""
    now = business_now(business)
    today = now.date()
    last_day = today + timedelta(days=business.max_days_ahead)
    busy = load_busy(db, business.id, _day_range(today)[0], _day_range(last_day)[1])

    days: list[tuple[date, int]] = []
    current = today
    while current <= last_day:
        slots = slots_by_professional(db, business, service, current, professional_id, now=now, busy=busy)
        days.append((current, len(slots)))
        current += timedelta(days=1)
    return days


def generate_code(db: Session) -> str:
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))
        if db.scalar(select(Appointment.id).where(Appointment.code == code)) is None:
            return code


def create_appointment(db: Session, business: Business, data: BookingIn, source: str = "online") -> Appointment:
    service = db.get(Service, data.service_id)
    if service is None or service.business_id != business.id or not service.is_active:
        raise BookingError("Serviço não encontrado.", 404)

    now = business_now(business)
    is_online = source == "online"
    if is_online:
        check_date_window(business, data.date, now)

    busy = load_busy(db, business.id, *_day_range(data.date))
    slots = slots_by_professional(
        db,
        business,
        service,
        data.date,
        data.professional_id,
        now=now,
        busy=busy,
        respect_advance=is_online,
    )

    start_at = datetime.combine(data.date, data.time).replace(second=0, microsecond=0)
    candidates = slots.get(start_at)
    if not candidates:
        raise BookingError("Esse horário não está mais disponível. Escolha outro, por favor.", 409)

    # "Qualquer profissional": escolhe quem tem a agenda mais livre no dia.
    by_professional, _ = busy
    professional_id = min(candidates, key=lambda pid: len(by_professional.get(pid, [])))

    appointment = Appointment(
        code=generate_code(db),
        business_id=business.id,
        service_id=service.id,
        professional_id=professional_id,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        customer_email=str(data.customer_email or ""),
        notes=data.notes,
        start_at=start_at,
        end_at=start_at + timedelta(minutes=service.duration_minutes),
        price_cents=service.price_cents,
        status="confirmed",
        source=source,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


def can_cancel(appointment: Appointment, business: Business) -> bool:
    return appointment.status == "confirmed" and appointment.start_at > business_now(business)
