import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LuCalendarDays,
  LuExternalLink,
  LuLayoutDashboard,
  LuLogOut,
  LuMenu,
  LuScissors,
  LuSettings,
  LuUsers,
  LuUserRound,
  LuX,
} from "react-icons/lu";
import Logo from "../components/Logo";
import { Avatar } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { to: "/painel", label: "Visão geral", icon: LuLayoutDashboard, end: true },
  { to: "/painel/agenda", label: "Agenda", icon: LuCalendarDays },
  { to: "/painel/servicos", label: "Serviços", icon: LuScissors },
  { to: "/painel/profissionais", label: "Profissionais", icon: LuUserRound },
  { to: "/painel/clientes", label: "Clientes", icon: LuUsers },
  { to: "/painel/configuracoes", label: "Configurações", icon: LuSettings },
];

export default function DashboardLayout() {
  const { user, business, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className={`shell${menuOpen ? " shell--menu-open" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar__top">
          <Logo to="/painel" light />
          <button type="button" className="icon-btn icon-btn--light sidebar__close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu">
            <LuX />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Menu do painel">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="sidebar__link">
              <Icon aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        {business && (
          <a className="sidebar__public" href={`/b/${business.slug}`} target="_blank" rel="noreferrer">
            <span>Sua página de agendamento</span>
            <strong>
              /b/{business.slug} <LuExternalLink aria-hidden />
            </strong>
          </a>
        )}

        <div className="sidebar__user">
          <Avatar name={user?.name || ""} color="#5B47E0" size={36} />
          <div>
            <strong>{user?.name}</strong>
            <span>{business?.name}</span>
          </div>
          <button type="button" className="icon-btn icon-btn--light" onClick={logout} aria-label="Sair" title="Sair">
            <LuLogOut />
          </button>
        </div>
      </aside>

      <div className="shell__backdrop" onClick={() => setMenuOpen(false)} aria-hidden />

      <div className="shell__main">
        <header className="topbar">
          <button type="button" className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
            <LuMenu />
          </button>
          <Logo to="/painel" />
        </header>
        <main className="content" id="conteudo">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
