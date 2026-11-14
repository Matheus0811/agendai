import { useEffect, useState } from "react";
import { LuCalendarX, LuMapPin, LuPlus, LuTrash2 } from "react-icons/lu";
import { ColorPicker, EmptyState, Field, PageHeader, PageLoader, Spinner, Switch } from "../../components/ui";
import { api } from "../../lib/api";
import { WEEKDAYS, dayjs, formatPhone, hhmm, toISODate } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const BRAND_COLORS = ["#5B47E0", "#C08A2E", "#17996F", "#E2674A", "#2F7DE1", "#C93F8B", "#1D1B3F", "#8B5E3C"];
const TABS = [
  { id: "business", label: "Negócio" },
  { id: "hours", label: "Horário de funcionamento" },
  { id: "timeoff", label: "Folgas e bloqueios" },
];

function BusinessTab() {
  const { business, setBusiness } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    ...business,
    phone: formatPhone(business.phone),
    whatsapp: formatPhone(business.whatsapp),
  }));
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => {
    const raw = e.target.value;
    const value = field === "phone" || field === "whatsapp" ? formatPhone(raw) : field === "slug" ? raw.toLowerCase().replace(/[^a-z0-9-]/g, "-") : raw;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await api("/business", {
        method: "PUT",
        body: {
          name: form.name,
          slug: form.slug.replace(/-+/g, "-").replace(/^-|-$/g, ""),
          category: form.category,
          description: form.description,
          phone: form.phone,
          whatsapp: form.whatsapp,
          instagram: form.instagram,
          address: form.address,
          city: form.city,
          primary_color: form.primary_color,
          slot_interval_minutes: Number(form.slot_interval_minutes),
          min_advance_minutes: Number(form.min_advance_minutes),
          max_days_ahead: Number(form.max_days_ahead),
        },
      });
      setBusiness(updated);
      setForm({ ...updated, phone: formatPhone(updated.phone), whatsapp: formatPhone(updated.whatsapp) });
      toast.success("Alterações salvas.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-split">
      <form className="panel form-stack" onSubmit={save}>
        <h2>Informações do negócio</h2>
        <div className="form-row">
          <Field label="Nome" htmlFor="b-name">
            <input id="b-name" value={form.name} onChange={set("name")} required minLength={2} />
          </Field>
          <Field label="Categoria" htmlFor="b-cat">
            <input id="b-cat" value={form.category} onChange={set("category")} />
          </Field>
        </div>
        <Field label="Descrição" htmlFor="b-desc" hint="Uma ou duas frases sobre o que torna seu negócio especial.">
          <textarea id="b-desc" rows={3} value={form.description} onChange={set("description")} maxLength={1000} />
        </Field>
        <div className="form-row">
          <Field label="WhatsApp" htmlFor="b-wa">
            <input id="b-wa" inputMode="tel" value={form.whatsapp} onChange={set("whatsapp")} placeholder="(11) 98765-4321" />
          </Field>
          <Field label="Telefone fixo" htmlFor="b-phone">
            <input id="b-phone" inputMode="tel" value={form.phone} onChange={set("phone")} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Endereço" htmlFor="b-address">
            <input id="b-address" value={form.address} onChange={set("address")} placeholder="Rua, número - bairro" />
          </Field>
          <Field label="Cidade" htmlFor="b-city">
            <input id="b-city" value={form.city} onChange={set("city")} placeholder="São Paulo - SP" />
          </Field>
        </div>
        <Field label="Instagram" htmlFor="b-ig">
          <div className="input-prefix">
            <span>@</span>
            <input id="b-ig" value={form.instagram} onChange={set("instagram")} />
          </div>
        </Field>

        <h2>Página de agendamento</h2>
        <Field label="Link da página" htmlFor="b-slug" hint="Só letras minúsculas, números e hífen.">
          <div className="input-prefix">
            <span>{window.location.host}/b/</span>
            <input id="b-slug" value={form.slug} onChange={set("slug")} required minLength={3} />
          </div>
        </Field>
        <Field label="Cor da página">
          <ColorPicker value={form.primary_color} onChange={(c) => setForm((f) => ({ ...f, primary_color: c }))} colors={BRAND_COLORS} />
        </Field>
        <div className="form-row form-row--3">
          <Field label="Horários de" htmlFor="b-interval" hint="Intervalo entre opções.">
            <select id="b-interval" value={form.slot_interval_minutes} onChange={set("slot_interval_minutes")}>
              {[10, 15, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m} em {m} min
                </option>
              ))}
            </select>
          </Field>
          <Field label="Antecedência mínima" htmlFor="b-advance">
            <select id="b-advance" value={form.min_advance_minutes} onChange={set("min_advance_minutes")}>
              <option value={0}>Sem antecedência</option>
              <option value={30}>30 minutos</option>
              <option value={60}>1 hora</option>
              <option value={120}>2 horas</option>
              <option value={240}>4 horas</option>
              <option value={1440}>1 dia</option>
            </select>
          </Field>
          <Field label="Agenda aberta por" htmlFor="b-ahead">
            <select id="b-ahead" value={form.max_days_ahead} onChange={set("max_days_ahead")}>
              {[7, 15, 30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d} dias
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? <Spinner /> : "Salvar alterações"}
          </button>
        </div>
      </form>

      <aside className="preview" aria-label="Prévia da página">
        <span className="preview__label">Prévia</span>
        <div className="preview__card" style={{ "--brand": form.primary_color }}>
          <div className="preview__cover" />
          <div className="preview__body">
            <span className="preview__mark">{form.name?.[0]?.toUpperCase()}</span>
            <strong>{form.name || "Seu negócio"}</strong>
            <small>{form.category}</small>
            {form.address && (
              <small className="preview__address">
                <LuMapPin aria-hidden /> {form.address}
              </small>
            )}
            <span className="preview__button">Agendar horário</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function HoursTab() {
  const toast = useToast();
  const [hours, setHours] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/business/hours")
      .then((list) =>
        setHours(
          list.map((h) => ({
            ...h,
            opens_at: hhmm(h.opens_at),
            closes_at: hhmm(h.closes_at),
            has_break: Boolean(h.break_start),
            break_start: h.break_start ? hhmm(h.break_start) : "12:00",
            break_end: h.break_end ? hhmm(h.break_end) : "13:00",
          })),
        ),
      )
      .catch((error) => toast.error(error.message));
  }, [toast]);

  if (!hours) return <PageLoader />;

  const update = (weekday, patch) => setHours((list) => list.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)));

  const copyToWeekdays = () => {
    const monday = hours.find((h) => h.weekday === 0);
    setHours((list) => list.map((h) => (h.weekday > 0 && h.weekday < 5 ? { ...monday, weekday: h.weekday } : h)));
    toast.success("Horário de segunda copiado até sexta. Lembre de salvar.");
  };

  const save = async () => {
    setSaving(true);
    try {
      await api("/business/hours", {
        method: "PUT",
        body: hours.map((h) => ({
          weekday: h.weekday,
          is_open: h.is_open,
          opens_at: h.opens_at,
          closes_at: h.closes_at,
          break_start: h.is_open && h.has_break ? h.break_start : null,
          break_end: h.is_open && h.has_break ? h.break_end : null,
        })),
      });
      toast.success("Horários salvos.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <h2>Horário de funcionamento</h2>
          <p>Os clientes só veem horários dentro destes períodos.</p>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={copyToWeekdays}>
          Copiar segunda para a semana
        </button>
      </header>
      <ul className="hours">
        {hours.map((h) => (
          <li key={h.weekday} className={h.is_open ? "" : "is-closed"}>
            <Switch id={`open-${h.weekday}`} checked={h.is_open} onChange={(v) => update(h.weekday, { is_open: v })} label={WEEKDAYS[h.weekday]} />
            {h.is_open ? (
              <div className="hours__times">
                <input type="time" value={h.opens_at} onChange={(e) => update(h.weekday, { opens_at: e.target.value })} aria-label={`Abre ${WEEKDAYS[h.weekday]}`} />
                <span>até</span>
                <input type="time" value={h.closes_at} onChange={(e) => update(h.weekday, { closes_at: e.target.value })} aria-label={`Fecha ${WEEKDAYS[h.weekday]}`} />
                <label className="check check--inline">
                  <input type="checkbox" checked={h.has_break} onChange={(e) => update(h.weekday, { has_break: e.target.checked })} />
                  Intervalo
                </label>
                {h.has_break && (
                  <>
                    <input type="time" value={h.break_start} onChange={(e) => update(h.weekday, { break_start: e.target.value })} aria-label="Início do intervalo" />
                    <span>até</span>
                    <input type="time" value={h.break_end} onChange={(e) => update(h.weekday, { break_end: e.target.value })} aria-label="Fim do intervalo" />
                  </>
                )}
              </div>
            ) : (
              <span className="muted">Fechado</span>
            )}
          </li>
        ))}
      </ul>
      <div className="form-actions">
        <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>
          {saving ? <Spinner /> : "Salvar horários"}
        </button>
      </div>
    </section>
  );
}

function TimeOffTab() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const today = toISODate(new Date());
  const [form, setForm] = useState({ professional_id: "", start_date: today, end_date: today, all_day: true, start_time: "12:00", end_time: "14:00", reason: "" });
  const [saving, setSaving] = useState(false);

  const load = () =>
    Promise.all([api("/time-off"), api("/professionals")])
      .then(([t, p]) => {
        setItems(t);
        setProfessionals(p);
      })
      .catch((error) => toast.error(error.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!items) return <PageLoader />;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const start = form.all_day ? `${form.start_date}T00:00:00` : `${form.start_date}T${form.start_time}:00`;
    const end = form.all_day ? `${form.end_date}T23:59:00` : `${form.end_date}T${form.end_time}:00`;
    try {
      await api("/time-off", {
        method: "POST",
        body: { professional_id: form.professional_id ? Number(form.professional_id) : null, start_at: start, end_at: end, reason: form.reason },
      });
      toast.success("Bloqueio criado. Esses horários saíram da página de agendamento.");
      setForm((f) => ({ ...f, reason: "" }));
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await api(`/time-off/${id}`, { method: "DELETE" });
      setItems((list) => list.filter((t) => t.id !== id));
      toast.success("Bloqueio removido.");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const proName = (id) => professionals.find((p) => p.id === id)?.name || "Profissional removido";

  const describe = (t) => {
    const s = dayjs(t.start_at);
    const e = dayjs(t.end_at);
    const fullDay = s.format("HH:mm") === "00:00" && e.format("HH:mm") === "23:59";
    if (s.isSame(e, "day")) return fullDay ? `${s.format("DD/MM/YYYY")}, dia inteiro` : `${s.format("DD/MM/YYYY")}, ${s.format("HH:mm")} às ${e.format("HH:mm")}`;
    return fullDay ? `${s.format("DD/MM")} a ${e.format("DD/MM/YYYY")}` : `${s.format("DD/MM HH:mm")} a ${e.format("DD/MM HH:mm")}`;
  };

  return (
    <div className="settings-split settings-split--even">
      <form className="panel form-stack" onSubmit={submit}>
        <h2>Novo bloqueio</h2>
        <p className="muted">Use para feriados, férias, folgas ou um compromisso. Os horários somem da página na hora.</p>
        <Field label="Para quem" htmlFor="to-pro">
          <select id="to-pro" value={form.professional_id} onChange={(e) => setForm({ ...form, professional_id: e.target.value })}>
            <option value="">Negócio inteiro (todos)</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-row">
          <Field label="De" htmlFor="to-start">
            <input id="to-start" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value, end_date: e.target.value > form.end_date ? e.target.value : form.end_date })} required />
          </Field>
          <Field label="Até" htmlFor="to-end">
            <input id="to-end" type="date" value={form.end_date} min={form.start_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
          </Field>
        </div>
        <Switch id="to-allday" checked={form.all_day} onChange={(v) => setForm({ ...form, all_day: v })} label="Dia inteiro" />
        {!form.all_day && (
          <div className="form-row">
            <Field label="Das" htmlFor="to-st">
              <input id="to-st" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </Field>
            <Field label="Às" htmlFor="to-et">
              <input id="to-et" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </Field>
          </div>
        )}
        <Field label="Motivo (só você vê)" htmlFor="to-reason">
          <input id="to-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Ex.: Feriado municipal" />
        </Field>
        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? <Spinner /> : (
              <>
                <LuPlus /> Bloquear horários
              </>
            )}
          </button>
        </div>
      </form>

      <section className="panel">
        <h2>Bloqueios cadastrados</h2>
        {items.length ? (
          <ul className="timeoff-list">
            {items.map((t) => (
              <li key={t.id} className={dayjs(t.end_at).isBefore(dayjs()) ? "is-past" : ""}>
                <div>
                  <strong>{t.professional_id ? proName(t.professional_id) : "Negócio inteiro"}</strong>
                  <span>{describe(t)}</span>
                  {t.reason && <small>{t.reason}</small>}
                </div>
                <button type="button" className="icon-btn icon-btn--danger" onClick={() => remove(t.id)} aria-label="Remover bloqueio">
                  <LuTrash2 />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={LuCalendarX} title="Nenhum bloqueio">Sua agenda segue o horário de funcionamento normal.</EmptyState>
        )}
      </section>
    </div>
  );
}

export default function Settings() {
  const { business } = useAuth();
  const [tab, setTab] = useState("business");
  if (!business) return <PageLoader />;

  return (
    <>
      <PageHeader title="Configurações" subtitle="Dados do negócio, horários e folgas." />
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "business" && <BusinessTab />}
      {tab === "hours" && <HoursTab />}
      {tab === "timeoff" && <TimeOffTab />}
    </>
  );
}
