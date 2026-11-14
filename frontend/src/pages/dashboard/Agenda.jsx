import { useCallback, useEffect, useMemo, useState } from "react";
import { LuCalendarPlus, LuChevronLeft, LuChevronRight, LuColumns3, LuList } from "react-icons/lu";
import AppointmentModal from "../../components/AppointmentModal";
import NewAppointmentModal from "../../components/NewAppointmentModal";
import { Avatar, EmptyState, PageHeader, StatusBadge, Switch } from "../../components/ui";
import { api } from "../../lib/api";
import { backendWeekday, capitalize, dayjs, formatMoney, hhmm, toISODate } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const PX_PER_MIN = 1.6;

const toMinutes = (value) => {
  const [h, m] = hhmm(value).split(":").map(Number);
  return h * 60 + m;
};
const minutesOfDay = (iso) => {
  const d = dayjs(iso);
  return d.hour() * 60 + d.minute();
};

export default function Agenda() {
  const { business } = useAuth();
  const toast = useToast();
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState({ services: [], professionals: [], hours: [] });
  const [view, setView] = useState("grid");
  const [showCancelled, setShowCancelled] = useState(false);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [now, setNow] = useState(() => dayjs());

  useEffect(() => {
    Promise.all([api("/services"), api("/professionals"), api("/business/hours")])
      .then(([services, professionals, hours]) => setCatalog({ services, professionals, hours }))
      .catch((error) => toast.error(error.message));
  }, [toast]);

  const load = useCallback(() => {
    setLoading(true);
    api("/appointments", { params: { start: date } })
      .then(setAppointments)
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [date, toast]);

  useEffect(load, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const visible = useMemo(
    () => appointments.filter((a) => showCancelled || a.status !== "cancelled"),
    [appointments, showCancelled],
  );

  const dayHours = catalog.hours.find((h) => h.weekday === backendWeekday(date));
  const isClosed = dayHours ? !dayHours.is_open : false;

  // Faixa de horas exibida: horário de funcionamento, ampliado se houver agendamento fora dele.
  const [rangeStart, rangeEnd] = useMemo(() => {
    let start = dayHours?.is_open ? toMinutes(dayHours.opens_at) : 8 * 60;
    let end = dayHours?.is_open ? toMinutes(dayHours.closes_at) : 18 * 60;
    visible.forEach((a) => {
      start = Math.min(start, minutesOfDay(a.start_at));
      end = Math.max(end, minutesOfDay(a.end_at) || 24 * 60);
    });
    return [Math.floor(start / 60) * 60, Math.ceil(end / 60) * 60];
  }, [dayHours, visible]);

  const columns = useMemo(() => {
    const active = catalog.professionals.filter((p) => p.is_active);
    const extra = catalog.professionals.filter((p) => !p.is_active && visible.some((a) => a.professional_id === p.id));
    return [...active, ...extra];
  }, [catalog.professionals, visible]);

  const hoursList = [];
  for (let m = rangeStart; m < rangeEnd; m += 60) hoursList.push(m);
  const gridHeight = (rangeEnd - rangeStart) * PX_PER_MIN;

  const isToday = date === toISODate(now);
  const nowMinutes = now.hour() * 60 + now.minute();
  const showNow = isToday && nowMinutes >= rangeStart && nowMinutes <= rangeEnd;

  const active = appointments.filter((a) => a.status !== "cancelled");
  const dayRevenue = active.reduce((sum, a) => sum + a.price_cents, 0);

  const shift = (days) => setDate((d) => toISODate(dayjs(d).add(days, "day")));

  const replaceAppointment = (updated) => setAppointments((list) => list.map((a) => (a.id === updated.id ? updated : a)));

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Clique em um horário para ver detalhes, concluir ou mandar lembrete."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
            <LuCalendarPlus /> Novo agendamento
          </button>
        }
      />

      <div className="agenda-toolbar">
        <div className="date-nav">
          <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Dia anterior">
            <LuChevronLeft />
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDate(toISODate(new Date()))} disabled={isToday}>
            Hoje
          </button>
          <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="Próximo dia">
            <LuChevronRight />
          </button>
          <label className="date-nav__label">
            <span>{capitalize(dayjs(date).format("dddd, D [de] MMMM"))}</span>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Escolher data" />
          </label>
        </div>

        <div className="agenda-toolbar__right">
          <span className="agenda-summary">
            {active.length} {active.length === 1 ? "atendimento" : "atendimentos"}, {formatMoney(dayRevenue)}
          </span>
          <Switch id="show-cancelled" checked={showCancelled} onChange={setShowCancelled} label="Cancelados" />
          <div className="segmented" role="group" aria-label="Modo de exibição">
            <button type="button" className={view === "grid" ? "is-active" : ""} onClick={() => setView("grid")} aria-label="Grade">
              <LuColumns3 />
            </button>
            <button type="button" className={view === "list" ? "is-active" : ""} onClick={() => setView("list")} aria-label="Lista">
              <LuList />
            </button>
          </div>
        </div>
      </div>

      {isClosed && <p className="notice">O negócio está fechado neste dia da semana. Agendamentos online não ficam disponíveis.</p>}

      {view === "grid" ? (
        <div className={`timegrid${loading ? " is-loading" : ""}`}>
          <div className="timegrid__head" style={{ gridTemplateColumns: `64px repeat(${columns.length || 1}, minmax(170px, 1fr))` }}>
            <span />
            {columns.map((p) => (
              <div key={p.id} className="timegrid__pro">
                <Avatar name={p.name} color={p.color} size={30} />
                <div>
                  <strong>{p.name}</strong>
                  <small>{visible.filter((a) => a.professional_id === p.id && a.status !== "cancelled").length} horários</small>
                </div>
              </div>
            ))}
          </div>
          <div className="timegrid__body" style={{ gridTemplateColumns: `64px repeat(${columns.length || 1}, minmax(170px, 1fr))`, height: gridHeight }}>
            <div className="timegrid__hours">
              {hoursList.map((m) => (
                <span key={m} style={{ top: (m - rangeStart) * PX_PER_MIN }}>
                  {String(m / 60).padStart(2, "0")}:00
                </span>
              ))}
            </div>
            {columns.map((p) => (
              <div key={p.id} className="timegrid__col">
                {hoursList.map((m) => (
                  <span key={m} className="timegrid__line" style={{ top: (m - rangeStart) * PX_PER_MIN }} />
                ))}
                {dayHours?.is_open && dayHours.break_start && (
                  <span
                    className="timegrid__break"
                    style={{
                      top: (toMinutes(dayHours.break_start) - rangeStart) * PX_PER_MIN,
                      height: (toMinutes(dayHours.break_end) - toMinutes(dayHours.break_start)) * PX_PER_MIN,
                    }}
                  >
                    Intervalo
                  </span>
                )}
                {visible
                  .filter((a) => a.professional_id === p.id)
                  .map((a) => {
                    const top = (minutesOfDay(a.start_at) - rangeStart) * PX_PER_MIN;
                    const height = Math.max(26, (dayjs(a.end_at).diff(dayjs(a.start_at), "minute")) * PX_PER_MIN - 3);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={`event event--${a.status}${height < 52 ? " event--compact" : ""}`}
                        style={{ top, height, "--c": a.professional_color }}
                        onClick={() => setSelected(a)}
                      >
                        <strong>{a.customer_name}</strong>
                        <span>
                          {dayjs(a.start_at).format("HH:mm")} {a.service_name}
                        </span>
                      </button>
                    );
                  })}
              </div>
            ))}
            {showNow && <span className="timegrid__now" style={{ top: (nowMinutes - rangeStart) * PX_PER_MIN }} />}
          </div>
        </div>
      ) : visible.length ? (
        <ul className="agenda-list">
          {visible.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => setSelected(a)}>
                <span className="agenda-list__time">
                  {dayjs(a.start_at).format("HH:mm")}
                  <small>{dayjs(a.end_at).format("HH:mm")}</small>
                </span>
                <span className="upcoming__bar" style={{ background: a.professional_color }} />
                <span className="agenda-list__info">
                  <strong>{a.customer_name}</strong>
                  <small>
                    {a.service_name} com {a.professional_name}
                  </small>
                </span>
                <span className="agenda-list__price">{formatMoney(a.price_cents)}</span>
                <StatusBadge status={a.status} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nenhum agendamento neste dia">Use o botão “Novo agendamento” para lançar um horário.</EmptyState>
      )}

      {selected && (
        <AppointmentModal
          appointment={selected}
          business={business}
          onClose={() => setSelected(null)}
          onUpdated={replaceAppointment}
        />
      )}
      <NewAppointmentModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(created) => {
          if (toISODate(created.start_at) === date) setAppointments((list) => [...list, created]);
          else setDate(toISODate(created.start_at));
        }}
        business={business}
        services={catalog.services}
        professionals={catalog.professionals}
        defaultDate={date}
      />
    </>
  );
}
