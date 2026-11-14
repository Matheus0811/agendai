import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  LuArrowLeft,
  LuCalendarCheck,
  LuCheck,
  LuClock3,
  LuDownload,
  LuInstagram,
  LuMapPin,
  LuMessageCircle,
  LuUsers,
} from "react-icons/lu";
import MonthCalendar from "../../components/MonthCalendar";
import { Avatar, Field, PageLoader, Spinner } from "../../components/ui";
import { LogoMark } from "../../components/Logo";
import { api } from "../../lib/api";
import {
  WEEKDAYS,
  backendWeekday,
  capitalize,
  dayjs,
  downloadIcs,
  formatDuration,
  formatMoney,
  formatPhone,
  googleCalendarLink,
  hhmm,
  whatsappLink,
} from "../../lib/format";
import { useToast } from "../../context/ToastContext";

const STEPS = ["Serviço", "Profissional", "Horário", "Seus dados"];
const SAVED_KEY = "agendai_customer";

function loadSavedCustomer() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY)) || null;
  } catch {
    return null;
  }
}

function openStatus(hours) {
  const now = dayjs();
  const today = hours.find((h) => h.weekday === backendWeekday(now));
  if (!today?.is_open) return { open: false, text: "Fechado hoje" };
  const current = now.format("HH:mm");
  const opens = hhmm(today.opens_at);
  const closes = hhmm(today.closes_at);
  if (current < opens) return { open: false, text: `Abre hoje às ${opens}` };
  if (current >= closes) return { open: false, text: "Fechado agora" };
  if (today.break_start && current >= hhmm(today.break_start) && current < hhmm(today.break_end)) {
    return { open: false, text: `Em intervalo, volta às ${hhmm(today.break_end)}` };
  }
  return { open: true, text: `Aberto até ${closes}` };
}

function groupTimes(times) {
  const groups = [
    { label: "Manhã", items: [] },
    { label: "Tarde", items: [] },
    { label: "Noite", items: [] },
  ];
  times.forEach((t) => {
    const hour = Number(t.slice(0, 2));
    groups[hour < 12 ? 0 : hour < 18 ? 1 : 2].items.push(t);
  });
  return groups.filter((g) => g.items.length);
}

export default function Booking() {
  const { slug } = useParams();
  const toast = useToast();
  const [business, setBusiness] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep] = useState(0);
  const [service, setService] = useState(null);
  const [professional, setProfessional] = useState(null); // null = qualquer
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [times, setTimes] = useState(null);
  const [customer, setCustomer] = useState(() => {
    const saved = loadSavedCustomer();
    return { name: saved?.name || "", phone: saved?.phone || "", email: saved?.email || "", notes: "", remember: Boolean(saved) };
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    api(`/public/business/${slug}`, { auth: false })
      .then((data) => {
        setBusiness(data);
        document.title = `Agendar em ${data.name}`;
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  const prosForService = useMemo(
    () => (business && service ? business.professionals.filter((p) => p.service_ids.includes(service.id)) : []),
    [business, service],
  );

  // Calendário de dias com horários livres
  useEffect(() => {
    if (step !== 2 || !service) return;
    let ignore = false;
    setCalendar(null);
    api(`/public/business/${slug}/calendar`, {
      auth: false,
      params: { service_id: service.id, professional_id: professional?.id },
    })
      .then((data) => {
        if (ignore) return;
        const map = Object.fromEntries(data.days.map((d) => [d.date, d.slots]));
        setCalendar(map);
        if (!date || !map[date]) setDate(data.days.find((d) => d.available)?.date || null);
      })
      .catch((error) => !ignore && toast.error(error.message));
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, service, professional, slug]);

  // Horários do dia escolhido
  useEffect(() => {
    if (step !== 2 || !service || !date) {
      setTimes(null);
      return;
    }
    let ignore = false;
    setTimes(null);
    api(`/public/business/${slug}/availability`, {
      auth: false,
      params: { service_id: service.id, date, professional_id: professional?.id },
    })
      .then((data) => !ignore && setTimes(data.times))
      .catch((error) => !ignore && toast.error(error.message));
    return () => {
      ignore = true;
    };
  }, [step, service, professional, date, slug, toast]);

  if (notFound) {
    return (
      <div className="not-found">
        <LogoMark size={48} />
        <h1>Não encontramos esta página.</h1>
        <p>Confira o link que você recebeu do estabelecimento.</p>
        <Link to="/" className="btn btn--primary">
          Conhecer o Agendaí
        </Link>
      </div>
    );
  }
  if (!business) return <PageLoader />;

  const status = openStatus(business.hours);
  const mapsLink = business.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.address} ${business.city}`)}`
    : null;
  const businessWhatsapp = whatsappLink(business.whatsapp, `Olá! Vim pela página de agendamento da ${business.name}.`);

  const chooseService = (s) => {
    setService(s);
    setTime(null);
    const pros = business.professionals.filter((p) => p.service_ids.includes(s.id));
    if (pros.length === 1) {
      setProfessional(pros[0]);
      setStep(2);
    } else {
      setProfessional(null);
      setStep(1);
    }
  };

  const chooseProfessional = (p) => {
    setProfessional(p);
    setTime(null);
    setStep(2);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await api(`/public/business/${slug}/appointments`, {
        method: "POST",
        auth: false,
        body: {
          service_id: service.id,
          professional_id: professional?.id ?? null,
          date,
          time,
          customer_name: customer.name,
          customer_phone: customer.phone,
          customer_email: customer.email || null,
          notes: customer.notes,
        },
      });
      try {
        if (customer.remember) {
          localStorage.setItem(SAVED_KEY, JSON.stringify({ name: customer.name, phone: customer.phone, email: customer.email }));
        } else {
          localStorage.removeItem(SAVED_KEY);
        }
      } catch {
        /* sem armazenamento disponível */
      }
      setConfirmation(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast.error(error.message);
      if (error.status === 409) {
        setTime(null);
        setStep(2);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const brandStyle = { "--brand": business.primary_color };

  if (confirmation) {
    const start = dayjs(confirmation.start_at);
    const event = {
      title: `${confirmation.service_name} em ${business.name}`,
      start: confirmation.start_at,
      end: confirmation.end_at,
      details: `Com ${confirmation.professional_name}. Código: ${confirmation.code}. Gerenciar: ${window.location.origin}/agendamento/${confirmation.code}`,
      location: [business.address, business.city].filter(Boolean).join(", "),
    };
    return (
      <div className="booking" style={brandStyle}>
        <div className="confirm">
          <div className="confirm__badge">
            <LuCheck aria-hidden />
          </div>
          <h1>Agendado, {confirmation.customer_name.split(" ")[0]}!</h1>
          <p className="confirm__lead">
            {capitalize(start.format("dddd, D [de] MMMM"))} às {start.format("HH:mm")}
          </p>
          <div className="ticket">
            <div className="ticket__row">
              <span>Serviço</span>
              <strong>{confirmation.service_name}</strong>
            </div>
            <div className="ticket__row">
              <span>Profissional</span>
              <strong>{confirmation.professional_name}</strong>
            </div>
            <div className="ticket__row">
              <span>Local</span>
              <strong>{business.name}</strong>
            </div>
            <div className="ticket__row">
              <span>Valor</span>
              <strong>{formatMoney(confirmation.price_cents)}</strong>
            </div>
            <div className="ticket__code">
              <span>Código do agendamento</span>
              <strong>{confirmation.code}</strong>
            </div>
          </div>
          <div className="confirm__actions">
            <a className="btn btn--brand" href={googleCalendarLink(event)} target="_blank" rel="noreferrer">
              <LuCalendarCheck /> Salvar no Google Agenda
            </a>
            <button type="button" className="btn btn--ghost" onClick={() => downloadIcs({ ...event, filename: `agendamento-${confirmation.code}.ics` })}>
              <LuDownload /> Baixar para o calendário
            </button>
          </div>
          <p className="confirm__manage">
            Precisa cancelar? <Link to={`/agendamento/${confirmation.code}`}>Gerencie seu agendamento</Link>
          </p>
          {businessWhatsapp && (
            <a className="link" href={businessWhatsapp} target="_blank" rel="noreferrer">
              <LuMessageCircle aria-hidden /> Falar com {business.name} no WhatsApp
            </a>
          )}
        </div>
        <footer className="booking__footer">
          Agendamento por <Link to="/">Agendaí</Link>
        </footer>
      </div>
    );
  }

  const today = backendWeekday(dayjs());

  return (
    <div className="booking" style={brandStyle}>
      <header className="booking__hero">
        <div className="booking__hero-inner">
          <span className="booking__mark" aria-hidden>
            {business.name[0]}
          </span>
          <div className="booking__title">
            <span className="booking__category">{business.category}</span>
            <h1>{business.name}</h1>
            {business.description && <p>{business.description}</p>}
            <ul className="booking__meta">
              <li className={status.open ? "is-open" : ""}>
                <LuClock3 aria-hidden /> {status.text}
              </li>
              {business.address && (
                <li>
                  <LuMapPin aria-hidden />
                  <a href={mapsLink} target="_blank" rel="noreferrer">
                    {business.address}
                    {business.city ? `, ${business.city}` : ""}
                  </a>
                </li>
              )}
              {business.instagram && (
                <li>
                  <LuInstagram aria-hidden />
                  <a href={`https://instagram.com/${business.instagram}`} target="_blank" rel="noreferrer">
                    @{business.instagram}
                  </a>
                </li>
              )}
            </ul>
          </div>
          {businessWhatsapp && (
            <a className="btn btn--light booking__wa" href={businessWhatsapp} target="_blank" rel="noreferrer">
              <LuMessageCircle /> WhatsApp
            </a>
          )}
        </div>
      </header>

      <div className="booking__layout">
        <main className="booking__main">
          <ol className="stepper" aria-label="Etapas do agendamento">
            {STEPS.map((label, index) => (
              <li key={label} className={index === step ? "is-current" : index < step ? "is-done" : ""}>
                <span>{index < step ? <LuCheck aria-hidden /> : index + 1}</span>
                {label}
              </li>
            ))}
          </ol>

          {step > 0 && (
            <button type="button" className="back-link" onClick={() => setStep(step === 2 && prosForService.length === 1 ? 0 : step - 1)}>
              <LuArrowLeft aria-hidden /> Voltar
            </button>
          )}

          {step === 0 && (
            <section>
              <h2 className="booking__h2">Escolha o serviço</h2>
              {business.services.length ? (
                <ul className="choice-list">
                  {business.services.map((s) => (
                    <li key={s.id}>
                      <button type="button" className={`choice${service?.id === s.id ? " is-selected" : ""}`} onClick={() => chooseService(s)}>
                        <span className="choice__text">
                          <strong>{s.name}</strong>
                          {s.description && <small>{s.description}</small>}
                        </span>
                        <span className="choice__meta">
                          <strong>{formatMoney(s.price_cents)}</strong>
                          <small>{formatDuration(s.duration_minutes)}</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="notice">Este estabelecimento ainda não cadastrou serviços para agendamento online.</p>
              )}
            </section>
          )}

          {step === 1 && (
            <section>
              <h2 className="booking__h2">Com quem você quer agendar?</h2>
              <ul className="pro-choices">
                <li>
                  <button type="button" className="pro-choice" onClick={() => chooseProfessional(null)}>
                    <span className="pro-choice__any">
                      <LuUsers aria-hidden />
                    </span>
                    <strong>Qualquer profissional</strong>
                    <small>Mais horários disponíveis</small>
                  </button>
                </li>
                {prosForService.map((p) => (
                  <li key={p.id}>
                    <button type="button" className={`pro-choice${professional?.id === p.id ? " is-selected" : ""}`} onClick={() => chooseProfessional(p)}>
                      <Avatar name={p.name} color={p.color} size={56} />
                      <strong>{p.name}</strong>
                      <small>{p.role || "Profissional"}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {step === 2 && (
            <section>
              <h2 className="booking__h2">Escolha dia e horário</h2>
              <div className="datetime">
                {calendar ? (
                  <MonthCalendar
                    value={date}
                    onChange={(d) => {
                      setDate(d);
                      setTime(null);
                    }}
                    availability={calendar}
                    minDate={dayjs().format("YYYY-MM-DD")}
                    maxDate={dayjs().add(business.max_days_ahead, "day").format("YYYY-MM-DD")}
                  />
                ) : (
                  <div className="calendar calendar--loading">
                    <Spinner />
                  </div>
                )}
                <div className="times">
                  {!date && calendar && <p className="muted">Nenhum dia com horário livre nos próximos {business.max_days_ahead} dias.</p>}
                  {date && (
                    <>
                      <h3>{capitalize(dayjs(date).format("dddd, D [de] MMMM"))}</h3>
                      {times === null ? (
                        <Spinner />
                      ) : times.length ? (
                        groupTimes(times).map((group) => (
                          <div key={group.label} className="times__group">
                            <span className="times__label">{group.label}</span>
                            <div className="times__chips">
                              {group.items.map((t) => (
                                <button key={t} type="button" className={`time-chip${time === t ? " is-selected" : ""}`} onClick={() => setTime(t)}>
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="muted">Este dia lotou. Escolha outra data no calendário.</p>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="booking__next">
                <button type="button" className="btn btn--brand btn--lg" disabled={!time} onClick={() => setStep(3)}>
                  {time ? `Continuar com ${time}` : "Escolha um horário"}
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <h2 className="booking__h2">Seus dados</h2>
              <form className="form-stack booking__form" onSubmit={submit}>
                <Field label="Nome completo" htmlFor="c-name">
                  <input id="c-name" autoComplete="name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} required minLength={2} />
                </Field>
                <div className="form-row">
                  <Field label="Celular com DDD" htmlFor="c-phone" hint="Usado só para falar sobre este horário.">
                    <input
                      id="c-phone"
                      inputMode="tel"
                      autoComplete="tel"
                      value={customer.phone}
                      onChange={(e) => setCustomer({ ...customer, phone: formatPhone(e.target.value) })}
                      placeholder="(11) 98765-4321"
                      required
                      minLength={14}
                    />
                  </Field>
                  <Field label="E-mail (opcional)" htmlFor="c-email">
                    <input id="c-email" type="email" autoComplete="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
                  </Field>
                </div>
                <Field label="Alguma observação?" htmlFor="c-notes">
                  <textarea id="c-notes" rows={2} value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} maxLength={500} placeholder="Ex.: é minha primeira vez" />
                </Field>
                <label className="check">
                  <input type="checkbox" checked={customer.remember} onChange={(e) => setCustomer({ ...customer, remember: e.target.checked })} />
                  Lembrar meus dados neste aparelho
                </label>
                <button type="submit" className="btn btn--brand btn--lg btn--block" disabled={submitting}>
                  {submitting ? <Spinner /> : "Confirmar agendamento"}
                </button>
              </form>
            </section>
          )}
        </main>

        <aside className="booking__side">
          <div className="summary">
            <h2>Resumo</h2>
            {service ? (
              <dl>
                <div>
                  <dt>Serviço</dt>
                  <dd>
                    {service.name}
                    <small>{formatDuration(service.duration_minutes)}</small>
                  </dd>
                </div>
                {step >= 2 && (
                  <div>
                    <dt>Profissional</dt>
                    <dd>{professional ? professional.name : "Qualquer profissional"}</dd>
                  </div>
                )}
                {date && step >= 2 && (
                  <div>
                    <dt>Quando</dt>
                    <dd>
                      {capitalize(dayjs(date).format("ddd, DD/MM"))}
                      {time && ` às ${time}`}
                    </dd>
                  </div>
                )}
                <div className="summary__total">
                  <dt>Total</dt>
                  <dd>{formatMoney(service.price_cents)}</dd>
                </div>
              </dl>
            ) : (
              <p className="muted">Escolha um serviço para começar.</p>
            )}
            <p className="summary__note">Pagamento no local.</p>
          </div>

          <div className="hours-card">
            <h2>Horário de funcionamento</h2>
            <ul>
              {business.hours.map((h) => (
                <li key={h.weekday} className={h.weekday === today ? "is-today" : ""}>
                  <span>{WEEKDAYS[h.weekday]}</span>
                  <span>
                    {h.is_open
                      ? `${hhmm(h.opens_at)} às ${hhmm(h.closes_at)}`
                      : "Fechado"}
                  </span>
                </li>
              ))}
            </ul>
            {business.phone && <p className="muted">Telefone: {formatPhone(business.phone)}</p>}
          </div>
        </aside>
      </div>

      <footer className="booking__footer">
        Agendamento por <Link to="/">Agendaí</Link>
      </footer>
    </div>
  );
}
