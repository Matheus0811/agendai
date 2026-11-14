from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.deps import DB, CurrentBusiness
from app.models import Business, BusinessHour, Professional, TimeOff
from app.schemas import BusinessHourIn, BusinessHourOut, BusinessOut, BusinessUpdate, TimeOffIn, TimeOffOut
from app.utils import get_owned_or_404

router = APIRouter(tags=["Meu negócio"])


@router.get("/business", response_model=BusinessOut)
def get_business(business: CurrentBusiness):
    return business


@router.put("/business", response_model=BusinessOut)
def update_business(data: BusinessUpdate, business: CurrentBusiness, db: DB):
    taken = db.scalar(select(Business).where(Business.slug == data.slug, Business.id != business.id))
    if taken:
        raise HTTPException(status_code=409, detail="Este link já está em uso por outro negócio.")

    for field, value in data.model_dump().items():
        setattr(business, field, value)
    db.commit()
    db.refresh(business)
    return business


@router.get("/business/hours", response_model=list[BusinessHourOut])
def get_hours(business: CurrentBusiness):
    return sorted(business.hours, key=lambda hour: hour.weekday)


@router.put("/business/hours", response_model=list[BusinessHourOut])
def update_hours(data: list[BusinessHourIn], business: CurrentBusiness, db: DB):
    weekdays = [item.weekday for item in data]
    if sorted(weekdays) != list(range(7)):
        raise HTTPException(status_code=422, detail="Envie os 7 dias da semana, sem repetir.")

    current = {hour.weekday: hour for hour in business.hours}
    for item in data:
        hour = current.get(item.weekday)
        if hour is None:
            hour = BusinessHour(weekday=item.weekday)
            business.hours.append(hour)
        hour.is_open = item.is_open
        hour.opens_at = item.opens_at
        hour.closes_at = item.closes_at
        hour.break_start = item.break_start
        hour.break_end = item.break_end
    db.commit()
    return sorted(business.hours, key=lambda hour: hour.weekday)


@router.get("/time-off", response_model=list[TimeOffOut], tags=["Bloqueios"])
def list_time_off(business: CurrentBusiness, db: DB):
    return db.scalars(
        select(TimeOff).where(TimeOff.business_id == business.id).order_by(TimeOff.start_at.desc())
    ).all()


@router.post("/time-off", response_model=TimeOffOut, status_code=201, tags=["Bloqueios"])
def create_time_off(data: TimeOffIn, business: CurrentBusiness, db: DB):
    if data.professional_id is not None:
        get_owned_or_404(db, Professional, data.professional_id, business.id, "Profissional")
    time_off = TimeOff(
        business_id=business.id,
        professional_id=data.professional_id,
        start_at=data.start_at.replace(tzinfo=None, second=0, microsecond=0),
        end_at=data.end_at.replace(tzinfo=None, second=0, microsecond=0),
        reason=data.reason,
    )
    db.add(time_off)
    db.commit()
    db.refresh(time_off)
    return time_off


@router.delete("/time-off/{time_off_id}", status_code=204, tags=["Bloqueios"])
def delete_time_off(time_off_id: int, business: CurrentBusiness, db: DB):
    time_off = get_owned_or_404(db, TimeOff, time_off_id, business.id, "Bloqueio")
    db.delete(time_off)
    db.commit()
