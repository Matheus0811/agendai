import { useMemo, useState } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { WEEKDAYS_SHORT, capitalize, dayjs } from "../lib/format";

/**
 * Calendário mensal. `availability` é um objeto { "AAAA-MM-DD": quantidadeDeHorarios }.
 * Dias fora do objeto (ou com 0) ficam desabilitados quando `onlyAvailable` é true.
 */
export default function MonthCalendar({ value, onChange, availability = {}, onlyAvailable = true, minDate, maxDate }) {
  const [month, setMonth] = useState(() => dayjs(value || minDate || undefined).startOf("month"));

  const days = useMemo(() => {
    const start = month.startOf("month");
    const offset = (start.day() + 6) % 7; // semana começando na segunda
    const cells = [];
    for (let i = 0; i < offset; i += 1) cells.push(null);
    for (let d = 0; d < month.daysInMonth(); d += 1) cells.push(start.add(d, "day"));
    return cells;
  }, [month]);

  const min = minDate ? dayjs(minDate).startOf("month") : null;
  const max = maxDate ? dayjs(maxDate).startOf("month") : null;
  const canPrev = !min || month.isAfter(min);
  const canNext = !max || month.isBefore(max);
  const todayKey = dayjs().format("YYYY-MM-DD");

  return (
    <div className="calendar">
      <div className="calendar__header">
        <button type="button" className="icon-btn" disabled={!canPrev} onClick={() => setMonth((m) => m.subtract(1, "month"))} aria-label="Mês anterior">
          <LuChevronLeft />
        </button>
        <strong>{capitalize(month.format("MMMM [de] YYYY"))}</strong>
        <button type="button" className="icon-btn" disabled={!canNext} onClick={() => setMonth((m) => m.add(1, "month"))} aria-label="Próximo mês">
          <LuChevronRight />
        </button>
      </div>
      <div className="calendar__grid" role="grid">
        {WEEKDAYS_SHORT.map((name) => (
          <span key={name} className="calendar__weekday">
            {name}
          </span>
        ))}
        {days.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;
          const key = day.format("YYYY-MM-DD");
          const slots = availability[key] || 0;
          const outOfRange =
            (minDate && day.isBefore(dayjs(minDate), "day")) || (maxDate && day.isAfter(dayjs(maxDate), "day"));
          const disabled = outOfRange || (onlyAvailable && slots === 0);
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              className={`calendar__day${selected ? " is-selected" : ""}${key === todayKey ? " is-today" : ""}${slots > 0 ? " has-slots" : ""}`}
              disabled={disabled}
              onClick={() => onChange(key)}
              aria-pressed={selected}
              aria-label={`${day.format("D [de] MMMM")}${slots ? `, ${slots} horários livres` : ", sem horários"}`}
            >
              {day.date()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
