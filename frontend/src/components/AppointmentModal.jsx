import { useState } from "react";
import { LuBan, LuCalendarClock, LuCheck, LuMessageCircle, LuRotateCcw, LuUserX } from "react-icons/lu";
import Modal from "./Modal";
import { Avatar, StatusBadge } from "./ui";
import { api } from "../lib/api";
import { capitalize, dayjs, formatDuration, formatMoney, formatPhone, whatsappLink } from "../lib/format";
import { useToast } from "../context/ToastContext";

export default function AppointmentModal({ appointment, business, onClose, onUpdated }) {
  const toast = useToast();
  const [saving, setSaving] = useState(null);

  if (!appointment) return null;
  const start = dayjs(appointment.start_at);
  const end = dayjs(appointment.end_at);
  const firstName = appointment.customer_name.split(" ")[0];

  const reminder = whatsappLink(
    appointment.customer_phone,
    `Olá, ${firstName}! Passando para lembrar do seu horário na ${business?.name ?? "nossa casa"}: ` +
      `${appointment.service_name} ${start.format("dddd, DD/MM")} às ${start.format("HH:mm")} ` +
      `com ${appointment.professional_name}. Até lá!`,
  );

  const setStatus = async (status, message) => {
    setSaving(status);
    try {
      const updated = await api(`/appointments/${appointment.id}/status`, { method: "PATCH", body: { status } });
      onUpdated?.(updated);
      toast.success(message);
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(null);
    }
  };

  const isConfirmed = appointment.status === "confirmed";

  return (
    <Modal open onClose={onClose} title="Detalhes do agendamento">
      <div className="appt-detail">
        <div className="appt-detail__customer">
          <Avatar name={appointment.customer_name} color={appointment.professional_color} size={48} />
          <div>
            <strong>{appointment.customer_name}</strong>
            <a href={`tel:${appointment.customer_phone}`}>{formatPhone(appointment.customer_phone)}</a>
            {appointment.customer_email && <span>{appointment.customer_email}</span>}
          </div>
          <StatusBadge status={appointment.status} />
        </div>

        <dl className="detail-list">
          <div>
            <dt>Serviço</dt>
            <dd>
              {appointment.service_name} <span className="muted">({formatDuration(end.diff(start, "minute"))})</span>
            </dd>
          </div>
          <div>
            <dt>Quando</dt>
            <dd>
              {capitalize(start.format("dddd, D [de] MMMM"))}, {start.format("HH:mm")} às {end.format("HH:mm")}
            </dd>
          </div>
          <div>
            <dt>Profissional</dt>
            <dd>
              <span className="dot" style={{ background: appointment.professional_color }} />
              {appointment.professional_name}
            </dd>
          </div>
          <div>
            <dt>Valor</dt>
            <dd>{formatMoney(appointment.price_cents)}</dd>
          </div>
          <div>
            <dt>Origem</dt>
            <dd>{appointment.source === "online" ? "Página de agendamento" : "Lançado pela equipe"}</dd>
          </div>
          <div>
            <dt>Código</dt>
            <dd className="code">{appointment.code}</dd>
          </div>
          {appointment.notes && (
            <div className="detail-list__full">
              <dt>Observações</dt>
              <dd>{appointment.notes}</dd>
            </div>
          )}
        </dl>

        {reminder && isConfirmed && (
          <a className="btn btn--whatsapp btn--block" href={reminder} target="_blank" rel="noreferrer">
            <LuMessageCircle /> Enviar lembrete pelo WhatsApp
          </a>
        )}

        <div className="appt-detail__actions">
          {isConfirmed ? (
            <>
              <button type="button" className="btn btn--mint" disabled={!!saving} onClick={() => setStatus("completed", "Atendimento concluído.")}>
                <LuCheck /> Concluir atendimento
              </button>
              <button type="button" className="btn btn--ghost" disabled={!!saving} onClick={() => setStatus("no_show", "Marcado como falta.")}>
                <LuUserX /> Cliente faltou
              </button>
              <button type="button" className="btn btn--ghost btn--danger" disabled={!!saving} onClick={() => setStatus("cancelled", "Agendamento cancelado.")}>
                <LuBan /> Cancelar
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--ghost" disabled={!!saving} onClick={() => setStatus("confirmed", "Agendamento reaberto.")}>
              <LuRotateCcw /> Voltar para confirmado
            </button>
          )}
        </div>
        <p className="appt-detail__meta">
          <LuCalendarClock aria-hidden /> Criado em {dayjs(appointment.created_at).format("DD/MM/YYYY [às] HH:mm")}
        </p>
      </div>
    </Modal>
  );
}
