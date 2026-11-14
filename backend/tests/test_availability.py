"""Testes da regra de horários disponíveis (não precisa de banco)."""
from datetime import date, datetime, time

from app.services.availability import DayHours, compute_slots, overlaps

MONDAY = date(2030, 1, 7)
HOURS = DayHours(opens_at=time(9, 0), closes_at=time(12, 0))


def at(hour: int, minute: int = 0) -> datetime:
    return datetime.combine(MONDAY, time(hour, minute))


def as_text(slots: list[datetime]) -> list[str]:
    return [slot.strftime("%H:%M") for slot in slots]


def test_overlaps():
    assert overlaps(at(9), at(10), at(9, 30), at(11))
    assert not overlaps(at(9), at(10), at(10), at(11))  # encostar não é sobrepor


def test_dia_fechado_nao_tem_horarios():
    assert compute_slots(MONDAY, None, 30, 30, []) == []


def test_gera_horarios_respeitando_a_duracao():
    slots = compute_slots(MONDAY, HOURS, duration_minutes=60, interval_minutes=30, busy=[])
    assert as_text(slots) == ["09:00", "09:30", "10:00", "10:30", "11:00"]


def test_pula_horarios_ocupados():
    busy = [(at(10), at(10, 30))]
    slots = compute_slots(MONDAY, HOURS, duration_minutes=30, interval_minutes=30, busy=busy)
    assert "10:00" not in as_text(slots)
    assert "09:30" in as_text(slots) and "10:30" in as_text(slots)


def test_servico_longo_nao_atropela_agendamento_seguinte():
    busy = [(at(10), at(10, 30))]
    slots = compute_slots(MONDAY, HOURS, duration_minutes=60, interval_minutes=30, busy=busy)
    # 09:30 terminaria 10:30 e bateria no agendamento das 10:00
    assert as_text(slots) == ["09:00", "10:30", "11:00"]


def test_respeita_intervalo_de_almoco():
    hours = DayHours(time(9, 0), time(14, 0), break_start=time(12, 0), break_end=time(13, 0))
    slots = as_text(compute_slots(MONDAY, hours, 30, 30, []))
    assert "11:30" in slots
    assert "12:00" not in slots and "12:30" not in slots
    assert "13:00" in slots


def test_nao_oferece_horarios_no_passado_nem_em_cima_da_hora():
    now = at(9, 10)
    slots = compute_slots(MONDAY, HOURS, 30, 30, [], now=now, min_advance_minutes=60)
    assert as_text(slots)[0] == "10:30"


def test_bloqueio_do_dia_inteiro():
    busy = [(at(0), at(23, 59))]
    assert compute_slots(MONDAY, HOURS, 30, 30, busy) == []
