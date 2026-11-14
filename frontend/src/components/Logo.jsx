import { Link } from "react-router-dom";

export function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="#5B47E0" />
      <rect x="14" y="18" width="36" height="32" rx="7" fill="none" stroke="#fff" strokeWidth="5" />
      <path d="M23 12v10M41 12v10" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <path d="M24 35l6 6 11-12" fill="none" stroke="#7CE3BE" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Logo({ to = "/", light = false }) {
  return (
    <Link to={to} className={`logo${light ? " logo--light" : ""}`} aria-label="Agendaí, página inicial">
      <LogoMark />
      <span>Agendaí</span>
    </Link>
  );
}
