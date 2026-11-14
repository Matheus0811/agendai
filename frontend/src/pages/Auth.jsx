import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LuEye, LuEyeOff, LuSparkles } from "react-icons/lu";
import Logo from "../components/Logo";
import { Field, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const CATEGORIES = [
  "Barbearia",
  "Salão de beleza",
  "Manicure e pedicure",
  "Estúdio de tatuagem",
  "Clínica de estética",
  "Fisioterapia",
  "Personal trainer",
  "Pet shop",
  "Outro",
];

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <div className="auth__form-side">
        <Logo />
        <div className="auth__box">
          <h1>{title}</h1>
          <p className="auth__subtitle">{subtitle}</p>
          {children}
        </div>
        <p className="auth__footer">{footer}</p>
      </div>
      <aside className="auth__art" aria-hidden>
        <div className="auth__ticket">
          <span className="auth__ticket-time">14:30</span>
          <div>
            <strong>Novo agendamento</strong>
            <span>Corte + Barba com Rafael</span>
          </div>
        </div>
        <div className="auth__ticket auth__ticket--b">
          <span className="auth__ticket-time">16:00</span>
          <div>
            <strong>Novo agendamento</strong>
            <span>Design de sobrancelha com Bruna</span>
          </div>
        </div>
        <p className="auth__art-text">
          Seus clientes marcam pelo link, a qualquer hora. Cada agendamento chega aqui já organizado na agenda do
          profissional certo.
        </p>
      </aside>
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-with-action">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required
        minLength={6}
        maxLength={72}
      />
      <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Esconder senha" : "Mostrar senha"}>
        {visible ? <LuEyeOff /> : <LuEye />}
      </button>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event, credentials = form) => {
    event?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await login(credentials.email, credentials.password);
      toast.success(`Bem-vindo de volta, ${user.name.split(" ")[0]}!`);
      navigate("/painel");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const enterDemo = () => {
    const demo = { email: "demo@agendai.com", password: "demo123" };
    setForm(demo);
    submit(null, demo);
  };

  return (
    <AuthLayout
      title="Entrar no painel"
      subtitle="Veja sua agenda, seus clientes e o faturamento do mês."
      footer={
        <>
          Ainda não tem conta? <Link to="/cadastro">Criar conta grátis</Link>
        </>
      }
    >
      <form onSubmit={submit} className="auth__form">
        <Field label="E-mail" htmlFor="login-email">
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </Field>
        <Field label="Senha" htmlFor="login-password">
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={loading}>
          {loading ? <Spinner /> : "Entrar"}
        </button>
      </form>
      <button type="button" className="demo-access" onClick={enterDemo} disabled={loading}>
        <LuSparkles aria-hidden />
        <span>
          <strong>Entrar na conta de demonstração</strong>
          Uma barbearia com 3 profissionais e agenda cheia.
        </span>
      </button>
    </AuthLayout>
  );
}

export function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", business_name: "", category: "Barbearia", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register(form);
      toast.success("Conta criada! Agora cadastre seus serviços.");
      navigate("/painel/servicos");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Criar sua agenda online"
      subtitle="Leva 5 minutos. Você pode mudar tudo depois."
      footer={
        <>
          Já tem conta? <Link to="/entrar">Entrar</Link>
        </>
      }
    >
      <form onSubmit={submit} className="auth__form">
        <Field label="Seu nome" htmlFor="reg-name">
          <input id="reg-name" autoComplete="name" value={form.name} onChange={update("name")} required minLength={2} />
        </Field>
        <div className="form-row">
          <Field label="Nome do negócio" htmlFor="reg-business">
            <input id="reg-business" value={form.business_name} onChange={update("business_name")} required minLength={2} placeholder="Ex.: Studio Bela" />
          </Field>
          <Field label="Tipo" htmlFor="reg-category">
            <select id="reg-category" value={form.category} onChange={update("category")}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="E-mail" htmlFor="reg-email">
          <input id="reg-email" type="email" autoComplete="email" value={form.email} onChange={update("email")} required />
        </Field>
        <Field label="Senha" htmlFor="reg-password" hint="Mínimo de 6 caracteres.">
          <PasswordInput id="reg-password" autoComplete="new-password" value={form.password} onChange={update("password")} />
        </Field>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={loading}>
          {loading ? <Spinner /> : "Criar conta"}
        </button>
      </form>
    </AuthLayout>
  );
}
