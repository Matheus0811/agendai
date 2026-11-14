from fastapi import APIRouter
from sqlalchemy import select

from app.deps import DB, CurrentBusiness
from app.models import Appointment
from app.schemas import CustomerOut
from app.services.booking import business_now

router = APIRouter(prefix="/customers", tags=["Clientes"])


@router.get("", response_model=list[CustomerOut])
def list_customers(business: CurrentBusiness, db: DB, search: str = ""):
    """Clientes são agrupados pelo telefone usado nos agendamentos."""
    appointments = db.scalars(
        select(Appointment).where(Appointment.business_id == business.id).order_by(Appointment.start_at)
    ).all()
    now = business_now(business)

    customers: dict[str, dict] = {}
    for appt in appointments:
        customer = customers.setdefault(
            appt.customer_phone,
            {
                "name": appt.customer_name,
                "phone": appt.customer_phone,
                "email": "",
                "visits": 0,
                "completed": 0,
                "cancelled": 0,
                "total_spent_cents": 0,
                "first_visit": None,
                "last_visit": None,
                "next_visit": None,
            },
        )
        customer["name"] = appt.customer_name  # o nome mais recente vence
        if appt.customer_email:
            customer["email"] = appt.customer_email

        if appt.status == "cancelled":
            customer["cancelled"] += 1
            continue

        customer["visits"] += 1
        if customer["first_visit"] is None:
            customer["first_visit"] = appt.start_at
        if appt.start_at <= now:
            customer["last_visit"] = appt.start_at
        elif customer["next_visit"] is None and appt.status == "confirmed":
            customer["next_visit"] = appt.start_at
        if appt.status == "completed":
            customer["completed"] += 1
            customer["total_spent_cents"] += appt.price_cents

    result = list(customers.values())
    term = search.strip().lower()
    if term:
        digits = "".join(ch for ch in term if ch.isdigit())
        result = [
            c
            for c in result
            if term in c["name"].lower() or term in c["email"].lower() or (digits and digits in c["phone"])
        ]
    result.sort(key=lambda c: (c["total_spent_cents"], c["visits"]), reverse=True)
    return result
