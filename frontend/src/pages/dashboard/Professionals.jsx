import { useEffect, useState } from "react";
import { LuPencil, LuPlus, LuTrash2, LuUserRound } from "react-icons/lu";
import Modal from "../../components/Modal";
import { Avatar, ColorPicker, EmptyState, Field, PageHeader, PageLoader, Spinner, Switch } from "../../components/ui";
import { api } from "../../lib/api";
import { PALETTE } from "../../lib/format";
import { useToast } from "../../context/ToastContext";

const blank = (count) => ({ name: "", role: "", color: PALETTE[count % PALETTE.length], is_active: true, service_ids: [] });

export default function Professionals() {
  const toast = useToast();
  const [professionals, setProfessionals] = useState(null);
  const [services, setServices] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank(0));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = () =>
    Promise.all([api("/professionals"), api("/services")])
      .then(([p, s]) => {
        setProfessionals(p);
        setServices(s);
      })
      .catch((error) => toast.error(error.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!professionals) return <PageLoader />;

  const openNew = () => {
    setForm({ ...blank(professionals.length), service_ids: services.map((s) => s.id) });
    setEditing({});
  };

  const openEdit = (p) => {
    setForm({ name: p.name, role: p.role, color: p.color, is_active: p.is_active, service_ids: p.service_ids });
    setEditing(p);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing.id) {
        await api(`/professionals/${editing.id}`, { method: "PUT", body: form });
        toast.success("Profissional atualizado.");
      } else {
        await api("/professionals", { method: "POST", body: form });
        toast.success("Profissional adicionado.");
      }
      setEditing(null);
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p) => {
    try {
      const updated = await api(`/professionals/${p.id}`, {
        method: "PUT",
        body: { name: p.name, role: p.role, color: p.color, is_active: !p.is_active, service_ids: p.service_ids },
      });
      setProfessionals((list) => list.map((x) => (x.id === p.id ? updated : x)));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const remove = async () => {
    try {
      await api(`/professionals/${confirmDelete.id}`, { method: "DELETE" });
      toast.success("Profissional removido.");
      setProfessionals((list) => list.filter((p) => p.id !== confirmDelete.id));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setConfirmDelete(null);
    }
  };

  const toggleService = (id) =>
    setForm((f) => ({
      ...f,
      service_ids: f.service_ids.includes(id) ? f.service_ids.filter((x) => x !== id) : [...f.service_ids, id],
    }));

  const serviceName = (id) => services.find((s) => s.id === id)?.name;

  return (
    <>
      <PageHeader
        title="Profissionais"
        subtitle="Cada profissional tem sua própria coluna na agenda."
        actions={
          <button type="button" className="btn btn--primary" onClick={openNew}>
            <LuPlus /> Adicionar profissional
          </button>
        }
      />

      {professionals.length ? (
        <div className="pro-grid">
          {professionals.map((p) => (
            <article key={p.id} className={`pro-card${p.is_active ? "" : " is-inactive"}`} style={{ "--c": p.color }}>
              <header>
                <Avatar name={p.name} color={p.color} size={52} />
                <div>
                  <h3>{p.name}</h3>
                  <span>{p.role || "Profissional"}</span>
                </div>
              </header>
              <div className="pro-card__services">
                {p.service_ids.length ? (
                  p.service_ids.map((id) => serviceName(id) && <span key={id}>{serviceName(id)}</span>)
                ) : (
                  <span className="warn-text">Sem serviços: não aparece para agendamento</span>
                )}
              </div>
              <footer>
                <Switch id={`pro-${p.id}`} checked={p.is_active} onChange={() => toggleActive(p)} label={p.is_active ? "Atendendo" : "Pausado"} />
                <div>
                  <button type="button" className="icon-btn" onClick={() => openEdit(p)} aria-label={`Editar ${p.name}`}>
                    <LuPencil />
                  </button>
                  <button type="button" className="icon-btn icon-btn--danger" onClick={() => setConfirmDelete(p)} aria-label={`Remover ${p.name}`}>
                    <LuTrash2 />
                  </button>
                </div>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={LuUserRound} title="Nenhum profissional ainda" action={<button type="button" className="btn btn--primary" onClick={openNew}>Adicionar profissional</button>}>
          Adicione quem atende para os clientes poderem escolher.
        </EmptyState>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Editar profissional" : "Novo profissional"}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>
              Cancelar
            </button>
            <button type="submit" form="pro-form" className="btn btn--primary" disabled={saving}>
              {saving ? <Spinner /> : "Salvar profissional"}
            </button>
          </>
        }
      >
        <form id="pro-form" className="form-stack" onSubmit={save}>
          <div className="pro-form__preview">
            <Avatar name={form.name || "?"} color={form.color} size={56} />
            <div className="form-stack">
              <Field label="Nome" htmlFor="pf-name">
                <input id="pf-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
              </Field>
              <Field label="Função" htmlFor="pf-role">
                <input id="pf-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Ex.: Cabeleireira" />
              </Field>
            </div>
          </div>
          <Field label="Cor na agenda">
            <ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} colors={PALETTE} />
          </Field>
          <fieldset className="checks">
            <legend>Serviços que realiza</legend>
            {services.length ? (
              services.map((s) => (
                <label key={s.id} className="check">
                  <input type="checkbox" checked={form.service_ids.includes(s.id)} onChange={() => toggleService(s.id)} />
                  {s.name}
                </label>
              ))
            ) : (
              <p className="muted">Cadastre serviços primeiro.</p>
            )}
          </fieldset>
          <Switch id="pf-active" checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Disponível para agendamentos" />
        </form>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Remover profissional?"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(null)}>
              Manter
            </button>
            <button type="button" className="btn btn--danger-solid" onClick={remove}>
              Remover
            </button>
          </>
        }
      >
        <p>Se {confirmDelete?.name} já tiver agendamentos, pause em vez de remover para manter o histórico.</p>
      </Modal>
    </>
  );
}
