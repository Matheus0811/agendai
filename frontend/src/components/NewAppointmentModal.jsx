import { useEffect, useState } from "react";
import Modal from "./Modal";
import { Field, Spinner } from "./ui";
import { api } from "../lib/api";
import { formatDuration, formatMoney, formatPhone, toISODate } from "../lib/format";
import { useToast } from "../context/ToastContext";

const emptyForm = (date) => ({
  service_id: "",
  professional_id: "",
  date: date || toISODate(new Date()),
  time: "",
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  notes: "",
});

export default function NewAppointmentModal({ open, onClose, onCreated, business, services, professionals, defaultDate }) {
  const toast = useToast();
  const [form, setForm] = useState(() => emptyForm(defaultDate));
  const [times, setTimes] = useState([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(emptyForm(defaultDate));
  }, [open, defaultDate]);

  const activeServices = services.filter((s) => s.is_active);
  const serviceId = Number(form.service_id) || null;
  const availablePros = professionals.filter((p) => p.is_active && (!serviceId || p.service_ids.includes(serviceId)));

  useEffect(() => {
    if (!open || !serviceId || !form.date || !business?.slug) {
      setTimes([]);
      return;
    }
    let ignore = false;
    setLoadingTimes(true);
    api(`/public/business/${business.slug}/availability`, {
      auth: false,
      params: { service_id: serviceId, date: form.date, professional_id: form.professional_id || undefined },
    })
      .then((data) => !ignore && setTimes(data.times))
      .catch(() => !ignore && setTimes([]))
      .finally(() => !ignore && setLoadingTimes(false));
    return () => {
      ignore = true;
    };
  }, [open, serviceId, form.date, form.professional_id, business?.slug]);

  const update = (field) => (event) => {
    const value = field === "customer_phone" ? formatPhone(event.target.value) : event.target.value;
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "service_id" || field === "professional_id" || field === "date" ? { time: "" } : {}),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await api("/appointments", {
        method: "POST",
        body: {
          ...form,
          service_id: serviceId,
          professional_id: form.professional_id ? Number(form.professional_id) : null,
          customer_email: form.customer_email || null,
        },
      });
      toast.success(`Agendamento de ${created.customer_name} criado.`);
      onCreated?.(created);
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo agendamento"
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="new-appointment" className="btn btn--primary" disabled={saving || !form.time}>
            {saving ? <Spinner /> : "Criar agendamento"}
          </button>
        </>
      }
    >
      <form id="new-appointment" className="form-grid" onSubmit={submit}>
        <Field label="Serviço" htmlFor="na-service">
          <select id="na-service" value={form.service_id} onChange={update("service_id")} required>
            <option value="">Escolha um serviço</option>
            {activeServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({formatDuration(s.duration_minutes)}, {formatMoney(s.price_cents)})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Profissional" htmlFor="na-pro">
          <select id="na-pro" value={form.professional_id} onChange={update("professional_id")}>
            <option value="">Qualquer profissional</option>
            {availablePros.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Data" htmlFor="na-date">
          <input id="na-date" type="date" value={form.date} min={toISODate(new Date())} onChange={update("date")} required />
        </Field>
        <Field label="Horário" htmlFor="na-time" hint={serviceId && !loadingTimes && !times.length ? "Nenhum horário livre nesse dia." : undefined}>
          <select id="na-time" value={form.time} onChange={update("time")} required disabled={!serviceId || loadingTimes}>
            <option value="">{loadingTimes ? "Buscando horários..." : "Escolha o horário"}</option>
            {times.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nome do cliente" htmlFor="na-name">
          <input id="na-name" value={form.customer_name} onChange={update("customer_name")} required minLength={2} />
        </Field>
        <Field label="Celular" htmlFor="na-phone">
          <input id="na-phone" inputMode="tel" value={form.customer_phone} onChange={update("customer_phone")} placeholder="(11) 98765-4321" required />
        </Field>
        <Field label="E-mail (opcional)" htmlFor="na-email">
          <input id="na-email" type="email" value={form.customer_email} onChange={update("customer_email")} />
        </Field>
        <Field label="Observações" htmlFor="na-notes">
          <input id="na-notes" value={form.notes} onChange={update("notes")} placeholder="Ex.: prefere tesoura" />
        </Field>
      </form>
    </Modal>
  );
}
