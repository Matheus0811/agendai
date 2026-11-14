import { LuLoaderCircle } from "react-icons/lu";
import { STATUS, initials } from "../lib/format";

export function Spinner({ label = "Carregando" }) {
  return (
    <span className="spinner" role="status">
      <LuLoaderCircle aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageLoader() {
  return (
    <div className="page-loader">
      <Spinner />
    </div>
  );
}

export function StatusBadge({ status }) {
  const info = STATUS[status] || { label: status, tone: "muted" };
  return <span className={`badge badge--${info.tone}`}>{info.label}</span>;
}

export function Avatar({ name, color = "#5B47E0", size = 36 }) {
  return (
    <span className="avatar" style={{ "--avatar": color, width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && (
        <span className="empty__icon">
          <Icon aria-hidden />
        </span>
      )}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div className={`field${error ? " field--error" : ""}`}>
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <small className="field__error">{error}</small> : hint && <small>{hint}</small>}
    </div>
  );
}

export function Switch({ checked, onChange, label, id }) {
  return (
    <label className="switch" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch__track" aria-hidden />
      {label && <span className="switch__label">{label}</span>}
    </label>
  );
}

export function ColorPicker({ value, onChange, colors }) {
  return (
    <div className="color-picker" role="radiogroup" aria-label="Cor">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value.toLowerCase() === color.toLowerCase()}
          aria-label={`Cor ${color}`}
          className="color-picker__swatch"
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
      <label className="color-picker__custom" title="Escolher outra cor">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        <span>Outra</span>
      </label>
    </div>
  );
}
