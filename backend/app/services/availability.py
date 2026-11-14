"""Cálculo de horários disponíveis.

Este módulo é "puro": não acessa o banco de dados, só recebe dados e devolve
resultados. Isso deixa a regra mais importante do sistema fácil de testar.
"""
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

Interval = tuple[datetime, datetime]


@dataclass(frozen=True)
class DayHours:
    opens_at: time
    closes_at: time
    break_start: time | None = None
    break_end: time | None = None


def overlaps(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
    """Dois intervalos [início, fim) se sobrepõem?"""
    return start_a < end_b and start_b < end_a


def compute_slots(
    day: date,
    hours: DayHours | None,
    duration_minutes: int,
    interval_minutes: int,
    busy: list[Interval],
    now: datetime | None = None,
    min_advance_minutes: int = 0,
) -> list[datetime]:
    """Retorna os horários de início livres em um dia.

    - day: o dia desejado
    - hours: horário de funcionamento do dia (None = fechado)
    - duration_minutes: duração do serviço
    - interval_minutes: de quantos em quantos minutos os horários são oferecidos
    - busy: intervalos ocupados (agendamentos, folgas, bloqueios)
    - now / min_advance_minutes: impede horários no passado ou em cima da hora
    """
    if hours is None or duration_minutes <= 0 or interval_minutes <= 0:
        return []

    day_start = datetime.combine(day, hours.opens_at)
    day_end = datetime.combine(day, hours.closes_at)
    duration = timedelta(minutes=duration_minutes)
    step = timedelta(minutes=interval_minutes)

    blocked: list[Interval] = [interval for interval in busy if overlaps(*interval, day_start, day_end)]
    if hours.break_start and hours.break_end:
        blocked.append((datetime.combine(day, hours.break_start), datetime.combine(day, hours.break_end)))

    earliest = now + timedelta(minutes=min_advance_minutes) if now else None

    slots: list[datetime] = []
    current = day_start
    while current + duration <= day_end:
        slot_end = current + duration
        is_future = earliest is None or current >= earliest
        is_free = not any(overlaps(current, slot_end, start, end) for start, end in blocked)
        if is_future and is_free:
            slots.append(current)
        current += step
    return slots

