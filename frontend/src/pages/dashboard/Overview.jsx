import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LuCalendarPlus, LuCheck, LuCopy, LuExternalLink, LuTrendingDown, LuTrendingUp } from "react-icons/lu";
import BarChart from "../../components/BarChart";
import AppointmentModal from "../../components/AppointmentModal";
import NewAppointmentModal from "../../components/NewAppointmentModal";
import { Avatar, EmptyState, PageHeader, PageLoader } from "../../components/ui";
import { api } from "../../lib/api";
import { capitalize, dayjs, formatMoney } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function Trend({ current, previous }) {
  if (!previous) return <span className="trend trend--flat">primeiro mês com dados</span>;
  const change = ((current - previous) / previous) * 100;
  const up = change >= 0;
  return (
    <span className={`trend ${up ? "trend--up" : "trend--down"}`}>
      {up ? <LuTrendingUp aria-hidden /> : <LuTrendingDown aria-hidden />}
      {Math.abs(change).toFixed(0)}% vs. mês passado
    </span>
  );
}

export default function Overview() {
  const { user, business } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [catalog, setCatalog] = useState({ services: [], professionals: [] });
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api("/dashboard")
      .then(setData)
      .catch((error) => toast.error(error.message));
  }, [toast]);

  useEffect(() => {
    load();
    Promise.all([api("/services"), api("/professionals")])
      .then(([services, professionals]) => setCatalog({ services, professionals }))
      .catch(() => {});
  }, [load]);

  if (!data) return <PageLoader />;

  const publicUrl = `${window.location.origin}/b/${business?.slug}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não deu para copiar. Selecione o link e copie manualmente.");
    }
  };

  const maxService = Math.max(1, ...data.top_services.map((s) => s.count));
  const totalWeek = data.daily.slice(-7).reduce((sum, d) => sum + d.appointments, 0);

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user?.name.split(" ")[0]}`}
        subtitle={capitalize(dayjs().format("dddd, D [de] MMMM"))}
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
            <LuCalendarPlus /> Novo agendamento
          </button>
        }
      />

      <section className="kpis" aria-label="Resumo">
        <div className="kpi kpi--hero">
          <span className="kpi__label">Hoje</span>
          <strong className="kpi__value">{data.today_total}</strong>
          <span className="kpi__note">
            {data.today_remaining} pela frente, {data.today_completed} concluídos
          </span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Faturamento do mês</span>
          <strong className="kpi__value">{formatMoney(data.month_revenue_cents)}</strong>
          <Trend current={data.month_revenue_cents} previous={data.previous_month_revenue_cents} />
        </div>
        <div className="kpi">
          <span className="kpi__label">Ainda a receber no mês</span>
          <strong className="kpi__value">{formatMoney(data.month_expected_cents)}</strong>
          <span className="kpi__note">em horários já confirmados</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Ticket médio</span>
          <strong className="kpi__value">{formatMoney(data.average_ticket_cents)}</strong>
          <span className="kpi__note">{data.month_appointments} atendimentos no mês</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Faltas e cancelamentos</span>
          <strong className="kpi__value">{(data.cancellation_rate * 100).toFixed(1).replace(".", ",")}%</strong>
          <span className="kpi__note">nos últimos 30 dias</span>
        </div>
      </section>

      <div className="overview-grid">
        <section className="panel panel--chart">
          <header className="panel__header">
            <div>
              <h2>Atendimentos por dia</h2>
              <p>{totalWeek} nos últimos 7 dias</p>
            </div>
          </header>
          <BarChart data={data.daily} />
        </section>

        <section className="panel">
          <header className="panel__header">
            <h2>Próximos horários</h2>
            <Link to="/painel/agenda" className="link">
              Ver agenda
            </Link>
          </header>
          {data.upcoming.length ? (
            <ul className="upcoming">
              {data.upcoming.map((appt) => {
                const start = dayjs(appt.start_at);
                const isToday = start.isSame(dayjs(), "day");
                return (
                  <li key={appt.id}>
                    <button type="button" onClick={() => setSelected(appt)}>
                      <span className="upcoming__time">
                        <strong>{start.format("HH:mm")}</strong>
                        <small>{isToday ? "hoje" : start.format("DD/MM")}</small>
                      </span>
                      <span className="upcoming__bar" style={{ background: appt.professional_color }} />
                      <span className="upcoming__info">
                        <strong>{appt.customer_name}</strong>
                        <small>
                          {appt.service_name} com {appt.professional_name.split(" ")[0]}
                        </small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="Nenhum horário marcado">Compartilhe seu link para receber agendamentos.</EmptyState>
          )}
        </section>

        <section className="panel">
          <header className="panel__header">
            <h2>Serviços mais pedidos no mês</h2>
          </header>
          {data.top_services.length ? (
            <ul className="ranking">
              {data.top_services.map((service) => (
                <li key={service.name}>
                  <div className="ranking__row">
                    <span>{service.name}</span>
                    <strong>{service.count}</strong>
                  </div>
                  <div className="ranking__bar">
                    <span style={{ width: `${(service.count / maxService) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Sem dados ainda">Os serviços aparecem aqui assim que forem agendados.</EmptyState>
          )}
        </section>

        <section className="panel panel--share">
          <div className="share__head">
            <Avatar name={business?.name || ""} color={business?.primary_color} size={44} />
            <div>
              <h2>Sua página de agendamento</h2>
              <p>{data.new_customers_month} clientes novos este mês</p>
            </div>
          </div>
          <div className="share__link">
            <span>{publicUrl.replace(/^https?:\/\//, "")}</span>
            <button type="button" className="btn btn--sm btn--ghost" onClick={copyLink}>
              {copied ? <LuCheck /> : <LuCopy />} {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="share__tip">Coloque esse link na bio do Instagram e na mensagem automática do WhatsApp.</p>
          <a className="btn btn--ghost btn--block" href={`/b/${business?.slug}`} target="_blank" rel="noreferrer">
            <LuExternalLink /> Abrir página
          </a>
        </section>
      </div>

      {selected && (
        <AppointmentModal appointment={selected} business={business} onClose={() => setSelected(null)} onUpdated={load} />
      )}
      <NewAppointmentModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={load}
        business={business}
        services={catalog.services}
        professionals={catalog.professionals}
      />
    </>
  );
}
