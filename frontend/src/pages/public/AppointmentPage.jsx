import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LuCalendarCheck, LuCalendarX, LuMapPin, LuMessageCircle } from "react-icons/lu";
import Modal from "../../components/Modal";
import { PageLoader, Spinner, StatusBadge } from "../../components/ui";
import { LogoMark } from "../../components/Logo";
import { api } from "../../lib/api";
import { capitalize, dayjs, formatMoney, googleCalendarLink, whatsappLink } from "../../lib/format";
import { useToast } from "../../context/ToastContext";

export default function AppointmentPage() {
  const { code } = useParams();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    api(`/public/appointments/${code}`, { auth: false })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [code]);

  if (error) {
    return (
      <div className="not-found">
        <LogoMark size={48} />
        <h1>Agendamento não encontrado</h1>
        <p>{error}</p>
        <Link to="/" className="btn btn--primary">
          Ir para o início
        </Link>
      </div>
    );
  }
  if (!data) return <PageLoader />;

  const { business } = data;
  const start = dayjs(data.start_at);

  const cancel = async () => {
    setCancelling(true);
    try {
      const updated = await api(`/public/appointments/${code}/cancel`, { method: "POST", auth: false });
      setData(updated);
      toast.success("Agendamento cancelado. O horário foi liberado.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCancelling(false);
      setConfirming(false);
    }
  };

  const wa = whatsappLink(business.whatsapp, `Olá! Sobre meu agendamento ${data.code} (${start.format("DD/MM [às] HH:mm")}).`);
  const location = [business.address, business.city].filter(Boolean).join(", ");

  return (
    <div className="booking" style={{ "--brand": business.primary_color }}>
      <div className="confirm">
        <span className="booking__mark booking__mark--sm" aria-hidden>
          {business.name[0]}
        </span>
        <p className="muted">{business.name}</p>
        <h1>{data.service_name}</h1>
        <p className="confirm__lead">
          {capitalize(start.format("dddd, D [de] MMMM"))} às {start.format("HH:mm")}
        </p>
        <StatusBadge status={data.status} />

        <div className="ticket">
          <div className="ticket__row">
            <span>Cliente</span>
            <strong>{data.customer_name}</strong>
          </div>
          <div className="ticket__row">
            <span>Profissional</span>
            <strong>{data.professional_name}</strong>
          </div>
          <div className="ticket__row">
            <span>Valor</span>
            <strong>{formatMoney(data.price_cents)}</strong>
          </div>
          {location && (
            <div className="ticket__row">
              <span>Endereço</span>
              <strong>
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`} target="_blank" rel="noreferrer">
                  <LuMapPin aria-hidden /> {location}
                </a>
              </strong>
            </div>
          )}
          <div className="ticket__code">
            <span>Código</span>
            <strong>{data.code}</strong>
          </div>
        </div>

        <div className="confirm__actions">
          {data.status === "confirmed" && (
            <a
              className="btn btn--brand"
              href={googleCalendarLink({ title: `${data.service_name} em ${business.name}`, start: data.start_at, end: data.end_at, location })}
              target="_blank"
              rel="noreferrer"
            >
              <LuCalendarCheck /> Salvar no Google Agenda
            </a>
          )}
          {data.can_cancel && (
            <button type="button" className="btn btn--ghost btn--danger" onClick={() => setConfirming(true)}>
              <LuCalendarX /> Cancelar agendamento
            </button>
          )}
          {data.status === "cancelled" && (
            <Link className="btn btn--brand" to={`/b/${business.slug}`}>
              Agendar outro horário
            </Link>
          )}
        </div>
        {wa && (
          <a className="link" href={wa} target="_blank" rel="noreferrer">
            <LuMessageCircle aria-hidden /> Falar com {business.name}
          </a>
        )}
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Cancelar este horário?"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirming(false)}>
              Manter horário
            </button>
            <button type="button" className="btn btn--danger-solid" onClick={cancel} disabled={cancelling}>
              {cancelling ? <Spinner /> : "Cancelar agendamento"}
            </button>
          </>
        }
      >
        <p>O horário de {start.format("DD/MM [às] HH:mm")} será liberado para outra pessoa.</p>
      </Modal>

      <footer className="booking__footer">
        Agendamento por <Link to="/">Agendaí</Link>
      </footer>
    </div>
  );
}
