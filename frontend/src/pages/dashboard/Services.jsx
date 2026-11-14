import { useEffect, useState } from "react";
import { LuClock3, LuPencil, LuPlus, LuScissors, LuTrash2 } from "react-icons/lu";
import Modal from "../../components/Modal";
import { Avatar, EmptyState, Field, PageHeader, PageLoader, Spinner, Switch } from "../../components/ui";
import { api } from "../../lib/api";
import { centsToInput, formatDuration, formatMoney, parseMoneyToCents } from "../../lib/format";
import { useToast } from "../../context/ToastContext";

const DURATIONS = [15, 20, 30, 40, 45, 50, 60, 75, 90, 120, 150, 180];

const blank = (professionals) => ({
  name: "",
  description: "",
  duration_minutes: 30,
  price: "0,00",
  is_active: true,
  professional_ids: professionals.filter((p) => p.is_active).map((p) => p.id),
});

export default function Services() {
  const toast = useToast();
  const [services, setServices] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [editing, setEditing] = useState(null); // null = fechado, {} = novo, {id} = edição
  const [form, setForm] = useState(blank([]));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = () =>
    Promise.all([api("/services"), api("/professionals")])
      .then(([s, p]) => {
        setServices(s);
        setProfessionals(p);
      })
      .catch((error) => toast.error(error.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!services) return <PageLoader />;

  const prosFor = (serviceId) => professionals.filter((p) => p.service_ids.includes(serviceId));

  const openNew = () => {
    setForm(blank(professionals));
    setEditing({});
  };

  const openEdit = (service) => {
    setForm({
      name: service.name,
      description: service.description,
      duration_minutes: service.duration_minutes,
      price: centsToInput(service.price_cents),
      is_active: service.is_active,
      professional_ids: prosFor(service.id).map((p) => p.id),
    });
    setEditing(service);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    const body = {
      name: form.name,
      description: form.description,
      duration_minutes: Number(form.duration_minutes),
      price_cents: parseMoneyToCents(form.price),
      is_active: form.is_active,
      professional_ids: form.professional_ids,
    };
    try {
      if (editing.id) {
        await api(`/services/${editing.id}`, { method: "PUT", body });
        toast.success("Serviço atualizado.");
      } else {
        await api("/services", { method: "POST", body });
        toast.success("Serviço criado.");
      }
      setEditing(null);
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (service) => {
    try {
      await api(`/services/${service.id}`, {
        method: "PUT",
        body: {
          name: service.name,
          description: service.description,
          duration_minutes: service.duration_minutes,
          price_cents: service.price_cents,
          is_active: !service.is_active,
        },
      });
      setServices((list) => list.map((s) => (s.id === service.id ? { ...s, is_active: !s.is_active } : s)));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const remove = async () => {
    try {
      await api(`/services/${confirmDelete.id}`, { method: "DELETE" });
      toast.success("Serviço excluído.");
      setServices((list) => list.filter((s) => s.id !== confirmDelete.id));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setConfirmDelete(null);
    }
  };

  const toggleProfessional = (id) =>
    setForm((f) => ({
      ...f,
      professional_ids: f.professional_ids.includes(id) ? f.professional_ids.filter((x) => x !== id) : [...f.professional_ids, id],
    }));

  return (
    <>
      <PageHeader
        title="Serviços"
        subtitle="O que aparece na sua página de agendamento, com preço e duração."
        actions={
          <button type="button" className="btn btn--primary" onClick={openNew}>
            <LuPlus /> Novo serviço
          </button>
        }
      />

      {services.length ? (
        <ul className="service-list">
          {services.map((service) => (
            <li key={service.id} className={service.is_active ? "" : "is-inactive"}>
              <div className="service-list__main">
                <strong>{service.name}</strong>
                {service.description && <p>{service.description}</p>}
                <div className="service-list__pros">
                  {prosFor(service.id).map((p) => (
                    <span key={p.id} className="pro-chip">
                      <Avatar name={p.name} color={p.color} size={20} />
                      {p.name.split(" ")[0]}
                    </span>
                  ))}
                  {!prosFor(service.id).length && <span className="warn-text">Nenhum profissional faz este serviço</span>}
                </div>
              </div>
              <span className="service-list__duration">
                <LuClock3 aria-hidden /> {formatDuration(service.duration_minutes)}
              </span>
              <span className="service-list__price">{formatMoney(service.price_cents)}</span>
              <div className="service-list__actions">
                <Switch id={`active-${service.id}`} checked={service.is_active} onChange={() => toggleActive(service)} label={service.is_active ? "Ativo" : "Inativo"} />
                <button type="button" className="icon-btn" onClick={() => openEdit(service)} aria-label={`Editar ${service.name}`}>
                  <LuPencil />
                </button>
                <button type="button" className="icon-btn icon-btn--danger" onClick={() => setConfirmDelete(service)} aria-label={`Excluir ${service.name}`}>
                  <LuTrash2 />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={LuScissors}
          title="Cadastre seu primeiro serviço"
          action={
            <button type="button" className="btn btn--primary" onClick={openNew}>
              <LuPlus /> Novo serviço
            </button>
          }
        >
          Sem serviços, a sua página de agendamento fica vazia. Comece pelo mais pedido.
        </EmptyState>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Editar serviço" : "Novo serviço"}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>
              Cancelar
            </button>
            <button type="submit" form="service-form" className="btn btn--primary" disabled={saving}>
              {saving ? <Spinner /> : "Salvar serviço"}
            </button>
          </>
        }
      >
        <form id="service-form" className="form-stack" onSubmit={save}>
          <Field label="Nome" htmlFor="sv-name">
            <input id="sv-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} placeholder="Ex.: Corte feminino" />
          </Field>
          <Field label="Descrição" htmlFor="sv-desc" hint="Aparece para o cliente na hora de escolher.">
            <textarea id="sv-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} />
          </Field>
          <div className="form-row">
            <Field label="Duração" htmlFor="sv-duration">
              <select id="sv-duration" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}>
                {[...new Set([...DURATIONS, Number(form.duration_minutes)])].sort((a, b) => a - b).map((d) => (
                  <option key={d} value={d}>
                    {formatDuration(d)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Preço (R$)" htmlFor="sv-price">
              <input id="sv-price" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </Field>
          </div>
          <fieldset className="checks">
            <legend>Quem faz este serviço</legend>
            {professionals.map((p) => (
              <label key={p.id} className="check">
                <input type="checkbox" checked={form.professional_ids.includes(p.id)} onChange={() => toggleProfessional(p.id)} />
                <Avatar name={p.name} color={p.color} size={24} />
                {p.name}
              </label>
            ))}
          </fieldset>
          <Switch id="sv-active" checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Disponível para agendamento online" />
        </form>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Excluir serviço?"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(null)}>
              Manter
            </button>
            <button type="button" className="btn btn--danger-solid" onClick={remove}>
              Excluir
            </button>
          </>
        }
      >
        <p>
          “{confirmDelete?.name}” vai sumir da sua página. Se ele já tiver agendamentos, desative em vez de excluir para
          manter o histórico.
        </p>
      </Modal>
    </>
  );
}
