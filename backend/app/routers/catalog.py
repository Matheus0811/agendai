"""Serviços e profissionais do negócio logado."""
from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from app.deps import DB, CurrentBusiness
from app.models import Appointment, Professional, Service
from app.schemas import ProfessionalIn, ProfessionalOut, ServiceIn, ServiceOut
from app.utils import get_owned_or_404

router = APIRouter()


def _load_services(db: DB, business_id: int, ids: list[int]) -> list[Service]:
    if not ids:
        return []
    services = db.scalars(select(Service).where(Service.business_id == business_id, Service.id.in_(ids))).all()
    if len(services) != len(set(ids)):
        raise HTTPException(status_code=422, detail="Um ou mais serviços informados não existem.")
    return list(services)


def _load_professionals(db: DB, business_id: int, ids: list[int]) -> list[Professional]:
    if not ids:
        return []
    professionals = db.scalars(
        select(Professional).where(Professional.business_id == business_id, Professional.id.in_(ids))
    ).all()
    if len(professionals) != len(set(ids)):
        raise HTTPException(status_code=422, detail="Um ou mais profissionais informados não existem.")
    return list(professionals)


def _count_appointments(db: DB, condition) -> int:
    return db.scalar(select(func.count(Appointment.id)).where(condition)) or 0


# ---------------- Serviços ----------------
@router.get("/services", response_model=list[ServiceOut], tags=["Serviços"])
def list_services(business: CurrentBusiness, db: DB):
    return db.scalars(select(Service).where(Service.business_id == business.id).order_by(Service.name)).all()


@router.post("/services", response_model=ServiceOut, status_code=201, tags=["Serviços"])
def create_service(data: ServiceIn, business: CurrentBusiness, db: DB):
    service = Service(business_id=business.id, **data.model_dump(exclude={"professional_ids"}))
    if data.professional_ids is None:
        # Sem escolha explícita: todos os profissionais ativos passam a fazer o serviço.
        service.professionals = [p for p in business.professionals if p.is_active]
    else:
        service.professionals = _load_professionals(db, business.id, data.professional_ids)
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.put("/services/{service_id}", response_model=ServiceOut, tags=["Serviços"])
def update_service(service_id: int, data: ServiceIn, business: CurrentBusiness, db: DB):
    service = get_owned_or_404(db, Service, service_id, business.id, "Serviço")
    for field, value in data.model_dump(exclude={"professional_ids"}).items():
        setattr(service, field, value)
    if data.professional_ids is not None:
        service.professionals = _load_professionals(db, business.id, data.professional_ids)
    db.commit()
    db.refresh(service)
    return service


@router.delete("/services/{service_id}", status_code=204, tags=["Serviços"])
def delete_service(service_id: int, business: CurrentBusiness, db: DB):
    service = get_owned_or_404(db, Service, service_id, business.id, "Serviço")
    if _count_appointments(db, Appointment.service_id == service.id):
        raise HTTPException(
            status_code=409,
            detail="Este serviço já tem agendamentos. Desative-o em vez de excluir para manter o histórico.",
        )
    db.delete(service)
    db.commit()


# ---------------- Profissionais ----------------
@router.get("/professionals", response_model=list[ProfessionalOut], tags=["Profissionais"])
def list_professionals(business: CurrentBusiness, db: DB):
    return db.scalars(
        select(Professional).where(Professional.business_id == business.id).order_by(Professional.name)
    ).all()


@router.post("/professionals", response_model=ProfessionalOut, status_code=201, tags=["Profissionais"])
def create_professional(data: ProfessionalIn, business: CurrentBusiness, db: DB):
    professional = Professional(business_id=business.id, **data.model_dump(exclude={"service_ids"}))
    professional.services = _load_services(db, business.id, data.service_ids)
    db.add(professional)
    db.commit()
    db.refresh(professional)
    return professional


@router.put("/professionals/{professional_id}", response_model=ProfessionalOut, tags=["Profissionais"])
def update_professional(professional_id: int, data: ProfessionalIn, business: CurrentBusiness, db: DB):
    professional = get_owned_or_404(db, Professional, professional_id, business.id, "Profissional")
    for field, value in data.model_dump(exclude={"service_ids"}).items():
        setattr(professional, field, value)
    professional.services = _load_services(db, business.id, data.service_ids)
    db.commit()
    db.refresh(professional)
    return professional


@router.delete("/professionals/{professional_id}", status_code=204, tags=["Profissionais"])
def delete_professional(professional_id: int, business: CurrentBusiness, db: DB):
    professional = get_owned_or_404(db, Professional, professional_id, business.id, "Profissional")
    if _count_appointments(db, Appointment.professional_id == professional.id):
        raise HTTPException(
            status_code=409,
            detail="Este profissional já tem agendamentos. Desative-o em vez de excluir.",
        )
    db.delete(professional)
    db.commit()
