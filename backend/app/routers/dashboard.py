from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import DB, CurrentBusiness
from app.models import Appointment
from app.schemas import DashboardOut, DailyPoint, TopService
from app.services.booking import business_now

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

ACTIVE = {"confirmed", "completed"}


def _month_start(day: date) -> date:
    return day.replace(day=1)


def _previous_month_start(day: date) -> date:
    first = _month_start(day)
    return _month_start(first - timedelta(days=1))


def _next_month_start(day: date) -> date:
    first = _month_start(day)
    return _month_start(first + timedelta(days=32))


@router.get("", response_model=DashboardOut)
def get_dashboard(business: CurrentBusiness, db: DB):
    now = business_now(business)
    today = now.date()
    month_start = _month_start(today)
    next_month = _next_month_start(today)
    prev_month = _previous_month_start(today)
    chart_start = today - timedelta(days=13)

    window_start = min(prev_month, chart_start, today - timedelta(days=30))
    appointments = db.scalars(
        select(Appointment)
        .options(selectinload(Appointment.service), selectinload(Appointment.professional))
        .where(
            Appointment.business_id == business.id,
            Appointment.start_at >= datetime.combine(window_start, time.min),
            Appointment.start_at < datetime.combine(next_month, time.min) + timedelta(days=60),
        )
        .order_by(Appointment.start_at)
    ).all()

    # Primeira visita de cada cliente (para contar clientes novos no mês).
    first_visits = dict(
        db.execute(
            select(Appointment.customer_phone, Appointment.start_at)
            .where(Appointment.business_id == business.id, Appointment.status != "cancelled")
            .order_by(Appointment.start_at.desc())
        ).all()
    )

    today_list = [a for a in appointments if a.start_at.date() == today and a.status in ACTIVE]
    month_list = [a for a in appointments if month_start <= a.start_at.date() < next_month]
    prev_list = [a for a in appointments if prev_month <= a.start_at.date() < month_start]
    last_30 = [a for a in appointments if today - timedelta(days=30) <= a.start_at.date() <= today]

    month_revenue = sum(a.price_cents for a in month_list if a.status == "completed")
    month_expected = sum(a.price_cents for a in month_list if a.status == "confirmed" and a.start_at >= now)
    previous_revenue = sum(a.price_cents for a in prev_list if a.status == "completed")
    completed_month = [a for a in month_list if a.status == "completed"]

    lost = sum(1 for a in last_30 if a.status in {"cancelled", "no_show"})
    cancellation_rate = round(lost / len(last_30), 4) if last_30 else 0.0

    daily_counts: dict[date, list[int]] = defaultdict(lambda: [0, 0])
    for appt in appointments:
        if chart_start <= appt.start_at.date() <= today and appt.status in ACTIVE:
            daily_counts[appt.start_at.date()][0] += 1
            if appt.status == "completed":
                daily_counts[appt.start_at.date()][1] += appt.price_cents
    daily = [
        DailyPoint(
            date=chart_start + timedelta(days=i),
            appointments=daily_counts[chart_start + timedelta(days=i)][0],
            revenue_cents=daily_counts[chart_start + timedelta(days=i)][1],
        )
        for i in range(14)
    ]

    service_counter: Counter[str] = Counter()
    service_revenue: dict[str, int] = defaultdict(int)
    for appt in month_list:
        if appt.status in ACTIVE:
            service_counter[appt.service_name] += 1
            if appt.status == "completed":
                service_revenue[appt.service_name] += appt.price_cents
    top_services = [
        TopService(name=name, count=count, revenue_cents=service_revenue[name])
        for name, count in service_counter.most_common(5)
    ]

    upcoming = [a for a in appointments if a.start_at >= now and a.status == "confirmed"][:6]

    return DashboardOut(
        today_total=len(today_list),
        today_remaining=sum(1 for a in today_list if a.status == "confirmed" and a.start_at >= now),
        today_completed=sum(1 for a in today_list if a.status == "completed"),
        month_revenue_cents=month_revenue,
        month_expected_cents=month_expected,
        previous_month_revenue_cents=previous_revenue,
        month_appointments=sum(1 for a in month_list if a.status in ACTIVE),
        cancellation_rate=cancellation_rate,
        new_customers_month=sum(1 for first in first_visits.values() if month_start <= first.date() < next_month),
        average_ticket_cents=round(month_revenue / len(completed_month)) if completed_month else 0,
        daily=daily,
        top_services=top_services,
        upcoming=upcoming,
    )
