"""Rotas públicas: usadas pela página de agendamento do cliente (sem login)."""
from datetime import date

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.deps import DB
from app.models import Appointment, Business, Service
from app.schemas import (
    AvailabilityOut,
    BookingIn,
    BusinessHourOut,
    CalendarDay,
    CalendarOut,
    PublicAppointmentOut,
    PublicBusinessOut,
    PublicBusinessSummary,
    PublicProfessional,
    ServiceOut,
)
from app.services.booking import (
    BookingError,
    availability_calendar,
    available_times,
    can_cancel,
    create_appointment,
)

router = APIRouter(prefix="/public", tags=["Público"])


def _get_business(db: DB, slug: str) -> Business:
    business = db.scalar(select(Business).where(Business.slug == slug))
    if business is None:
        raise HTTPException(status_code=404, detail="Página de agendamento não encontrada.")
    return business


def _get_service(db: DB, business: Business, service_id: int) -> Service:
    service = db.get(Service, service_id)
    if service is None or service.business_id != business.id or not service.is_active:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")
    return service


def _to_public(appointment: Appointment) -> PublicAppointmentOut:
    business = appointment.business
    return PublicAppointmentOut(
        code=appointment.code,
        status=appointment.status,
        service_name=appointment.service_name,
        professional_name=appointment.professional_name,
        start_at=appointment.start_at,
        end_at=appointment.end_at,
        price_cents=appointment.price_cents,
        customer_name=appointment.customer_name,
        can_cancel=can_cancel(appointment, business),
        business=PublicBusinessSummary.model_validate(business, from_attributes=True),
    )


@router.get("/business/{slug}", response_model=PublicBusinessOut)
def get_public_business(slug: str, db: DB):
    business = _get_business(db, slug)
    services = [s for s in business.services if s.is_active]
    active_ids = {s.id for s in services}
    professionals = [
        PublicProfessional(
            id=p.id,
            name=p.name,
            role=p.role,
            color=p.color,
            service_ids=[sid for sid in p.service_ids if sid in active_ids],
        )
        for p in business.professionals
        if p.is_active
    ]
    return PublicBusinessOut(
        name=business.name,
        slug=business.slug,
        category=business.category,
        description=business.description,
        phone=business.phone,
        whatsapp=business.whatsapp,
        instagram=business.instagram,
        address=business.address,
        city=business.city,
        primary_color=business.primary_color,
        max_days_ahead=business.max_days_ahead,
        hours=[BusinessHourOut.model_validate(h) for h in sorted(business.hours, key=lambda h: h.weekday)],
        services=[ServiceOut.model_validate(s) for s in services],
        professionals=professionals,
    )


@router.get("/business/{slug}/availability", response_model=AvailabilityOut)
def get_availability(
    slug: str,
    db: DB,
    service_id: int,
    day: date = Query(..., alias="date"),
    professional_id: int | None = None,
):
    business = _get_business(db, slug)
    service = _get_service(db, business, service_id)
    try:
        times = available_times(db, business, service, day, professional_id)
    except BookingError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message)
    return AvailabilityOut(date=day, times=times)


@router.get("/business/{slug}/calendar", response_model=CalendarOut)
def get_calendar(slug: str, db: DB, service_id: int, professional_id: int | None = None):
    business = _get_business(db, slug)
    service = _get_service(db, business, service_id)
    try:
        days = availability_calendar(db, business, service, professional_id)
    except BookingError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message)
    return CalendarOut(days=[CalendarDay(date=d, available=count > 0, slots=count) for d, count in days])


@router.post("/business/{slug}/appointments", response_model=PublicAppointmentOut, status_code=201)
def book(slug: str, data: BookingIn, db: DB):
    business = _get_business(db, slug)
    try:
        appointment = create_appointment(db, business, data, source="online")
    except BookingError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message)
    return _to_public(appointment)


def _get_by_code(db: DB, code: str) -> Appointment:
    appointment = db.scalar(select(Appointment).where(Appointment.code == code.upper()))
    if appointment is None:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado. Confira o código.")
    return appointment


@router.get("/appointments/{code}", response_model=PublicAppointmentOut)
def get_public_appointment(code: str, db: DB):
    return _to_public(_get_by_code(db, code))


@router.post("/appointments/{code}/cancel", response_model=PublicAppointmentOut)
def cancel_public_appointment(code: str, db: DB):
    appointment = _get_by_code(db, code)
    if not can_cancel(appointment, appointment.business):
        raise HTTPException(status_code=400, detail="Este agendamento não pode mais ser cancelado online.")
    appointment.status = "cancelled"
    db.commit()
    db.refresh(appointment)
    return _to_public(appointment)
