from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import DB, CurrentBusiness
from app.models import Appointment
from app.schemas import AppointmentOut, AppointmentStatus, BookingIn, StatusUpdate
from app.services.booking import BookingError, create_appointment
from app.utils import get_owned_or_404

router = APIRouter(prefix="/appointments", tags=["Agenda"])


@router.get("", response_model=list[AppointmentOut])
def list_appointments(
    business: CurrentBusiness,
    db: DB,
    start: date = Query(..., description="Data inicial (AAAA-MM-DD)"),
    end: date | None = Query(None, description="Data final, inclusiva. Padrão: igual à inicial"),
    status: AppointmentStatus | None = None,
    professional_id: int | None = None,
):
    end = end or start
    if end < start:
        raise HTTPException(status_code=422, detail="A data final deve ser depois da inicial.")
    if (end - start).days > 92:
        raise HTTPException(status_code=422, detail="Consulte no máximo 3 meses por vez.")

    stmt = (
        select(Appointment)
        .options(selectinload(Appointment.service), selectinload(Appointment.professional))
        .where(
            Appointment.business_id == business.id,
            Appointment.start_at >= datetime.combine(start, time.min),
            Appointment.start_at < datetime.combine(end + timedelta(days=1), time.min),
        )
        .order_by(Appointment.start_at)
    )
    if status:
        stmt = stmt.where(Appointment.status == status)
    if professional_id:
        stmt = stmt.where(Appointment.professional_id == professional_id)
    return db.scalars(stmt).all()


@router.post("", response_model=AppointmentOut, status_code=201)
def create_manual_appointment(data: BookingIn, business: CurrentBusiness, db: DB):
    """Agendamento feito pelo próprio negócio (telefone, balcão, WhatsApp)."""
    try:
        return create_appointment(db, business, data, source="manual")
    except BookingError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message)


@router.patch("/{appointment_id}/status", response_model=AppointmentOut)
def update_status(appointment_id: int, data: StatusUpdate, business: CurrentBusiness, db: DB):
    appointment = get_owned_or_404(db, Appointment, appointment_id, business.id, "Agendamento")
    appointment.status = data.status
    db.commit()
    db.refresh(appointment)
    return appointment
