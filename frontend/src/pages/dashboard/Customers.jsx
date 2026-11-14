import { useEffect, useMemo, useState } from "react";
import { LuMessageCircle, LuSearch, LuUsers } from "react-icons/lu";
import { Avatar, EmptyState, PageHeader, PageLoader } from "../../components/ui";
import { api } from "../../lib/api";
import { dayjs, formatMoney, formatPhone, whatsappLink } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const SORTS = {
  spent: { label: "Quem mais gastou", fn: (a, b) => b.total_spent_cents - a.total_spent_cents },
  visits: { label: "Mais visitas", fn: (a, b) => b.visits - a.visits },
  recent: { label: "Visita mais recente", fn: (a, b) => dayjs(b.last_visit || 0).valueOf() - dayjs(a.last_visit || 0).valueOf() },
  away: { label: "Sumidos há mais tempo", fn: (a, b) => dayjs(a.last_visit || 0).valueOf() - dayjs(b.last_visit || 0).valueOf() },
};

export default function Customers() {
  const { business } = useAuth();
  const toast = useToast();
  const [customers, setCustomers] = useState(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("spent");

  useEffect(() => {
    api("/customers")
      .then(setCustomers)
      .catch((error) => toast.error(error.message));
  }, [toast]);

  const list = useMemo(() => {
    if (!customers) return [];
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    return customers
      .filter((c) => !term || c.name.toLowerCase().includes(term) || (digits && c.phone.includes(digits)))
      .sort(SORTS[sort].fn);
  }, [customers, search, sort]);

  if (!customers) return <PageLoader />;

  const totalSpent = customers.reduce((sum, c) => sum + c.total_spent_cents, 0);
  const returning = customers.filter((c) => c.completed >= 2).length;

  return (
    <>
      <PageHeader title="Clientes" subtitle="Todo mundo que já agendou com você, com histórico e quanto gastou." />

      <div className="customer-stats">
        <div>
          <strong>{customers.length}</strong>
          <span>clientes</span>
        </div>
        <div>
          <strong>{customers.length ? Math.round((returning / customers.length) * 100) : 0}%</strong>
          <span>voltaram mais de uma vez</span>
        </div>
        <div>
          <strong>{formatMoney(totalSpent)}</strong>
          <span>em atendimentos concluídos</span>
        </div>
      </div>

      <div className="list-toolbar">
        <label className="search">
          <LuSearch aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou telefone" aria-label="Buscar cliente" />
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar">
          {Object.entries(SORTS).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {list.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Visitas</th>
                <th>Última visita</th>
                <th>Próximo horário</th>
                <th className="num">Total gasto</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const daysAway = c.last_visit ? dayjs().diff(dayjs(c.last_visit), "day") : null;
                const message = `Olá, ${c.name.split(" ")[0]}! Faz um tempinho que você não aparece na ${business?.name}. Que tal agendar seu horário? ${window.location.origin}/b/${business?.slug}`;
                return (
                  <tr key={c.phone}>
                    <td>
                      <div className="table__person">
                        <Avatar name={c.name} color="#5B47E0" size={34} />
                        <div>
                          <strong>{c.name}</strong>
                          <span>{formatPhone(c.phone)}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {c.visits}
                      {c.cancelled > 0 && <span className="muted"> ({c.cancelled} cancel.)</span>}
                    </td>
                    <td>
                      {c.last_visit ? (
                        <>
                          {dayjs(c.last_visit).format("DD/MM/YYYY")}
                          {daysAway > 45 && <span className="badge badge--amber badge--inline">há {daysAway} dias</span>}
                        </>
                      ) : (
                        <span className="muted">Ainda não veio</span>
                      )}
                    </td>
                    <td>{c.next_visit ? dayjs(c.next_visit).format("DD/MM [às] HH:mm") : <span className="muted">Nenhum</span>}</td>
                    <td className="num">{formatMoney(c.total_spent_cents)}</td>
                    <td>
                      <a className="icon-btn" href={whatsappLink(c.phone, message)} target="_blank" rel="noreferrer" aria-label={`Chamar ${c.name} no WhatsApp`} title="Chamar no WhatsApp">
                        <LuMessageCircle />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={LuUsers} title={customers.length ? "Ninguém encontrado" : "Sem clientes ainda"}>
          {customers.length ? "Tente outro nome ou telefone." : "Quando alguém agendar, aparece aqui automaticamente."}
        </EmptyState>
      )}
    </>
  );
}
