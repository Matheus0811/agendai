import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LuBellRing,
  LuCalendarCheck,
  LuChartColumn,
  LuCheck,
  LuClock3,
  LuLink,
} from "react-icons/lu";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import { WEEKDAYS_SHORT, backendWeekday, dayjs } from "../lib/format";

const DEMO_SLUG = "navalha-de-ouro";

const DEMO_TIMES = {
  0: ["09:00", "09:45", "10:30", "14:15", "16:00", "17:30"],
  1: ["10:15", "11:00", "13:30", "15:00", "18:00"],
  2: ["09:30", "13:00", "13:45", "16:30"],
  3: ["09:00", "11:15", "14:00", "15:30", "17:15", "18:00"],
  4: ["10:00", "10:45", "15:45"],
};
const TAKEN = new Set(["0-10:30", "1-13:30", "3-14:00"]);

function LiveBookingDemo() {
  const days = Array.from({ length: 5 }, (_, i) => dayjs().add(i + 1, "day"));
  const [dayIndex, setDayIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  const chosenDay = days[dayIndex];

  if (confirmed) {
    return (
      <div className="demo-card demo-card--done" aria-live="polite">
        <span className="demo-card__check">
          <LuCheck aria-hidden />
        </span>
        <h3>Horário reservado</h3>
        <p>
          Corte + Barba com Rafael, {WEEKDAYS_SHORT[backendWeekday(chosenDay)].toLowerCase()} {chosenDay.format("DD/MM")} às{" "}
          {picked}.
        </p>
        <p className="demo-card__code">
          Código <strong>K7Q2-M9XP</strong>
        </p>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            setConfirmed(false);
            setPicked(null);
          }}
        >
          Testar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="demo-card">
      <div className="demo-card__shop">
        <span className="demo-card__shop-mark" aria-hidden>
          N
        </span>
        <div>
          <strong>Navalha de Ouro</strong>
          <span>Corte + Barba, 1h15, R$ 70,00</span>
        </div>
      </div>

      <div className="demo-card__days" role="tablist" aria-label="Escolha o dia">
        {days.map((day, index) => (
          <button
            key={day.format("YYYY-MM-DD")}
            type="button"
            role="tab"
            aria-selected={index === dayIndex}
            className={index === dayIndex ? "is-active" : ""}
            onClick={() => {
              setDayIndex(index);
              setPicked(null);
            }}
          >
            <small>{WEEKDAYS_SHORT[backendWeekday(day)]}</small>
            <strong>{day.format("DD")}</strong>
          </button>
        ))}
      </div>

      <div className="demo-card__times">
        {DEMO_TIMES[dayIndex].map((time) => {
          const taken = TAKEN.has(`${dayIndex}-${time}`);
          return (
            <button
              key={time}
              type="button"
              disabled={taken}
              className={`time-chip${picked === time ? " is-selected" : ""}`}
              onClick={() => setPicked(time)}
            >
              {time}
            </button>
          );
        })}
      </div>

      <button type="button" className="btn btn--primary btn--block" disabled={!picked} onClick={() => setConfirmed(true)}>
        {picked ? `Confirmar ${picked}` : "Escolha um horário"}
      </button>
      <p className="demo-card__hint">Pode clicar: é assim que seu cliente agenda.</p>
    </div>
  );
}

const AGENDA_PREVIEW = [
  { name: "Rafael", color: "#5B47E0", blocks: [[0, 3, "Corte + Barba", "Pedro S."], [4, 2, "Corte", "Caio L."], [8, 2, "Barba", "Igor F."]] },
  { name: "Lucas", color: "#E2674A", blocks: [[1, 2, "Degradê", "João P."], [5, 1, "Sobrancelha", "Davi R."], [7, 3, "Corte + Barba", "Enzo M."]] },
  { name: "Bruno", color: "#17996F", blocks: [[0, 2, "Pigmentação", "Vitor A."], [3, 2, "Corte", "Renan C."], [9, 1, "Barba", "Otávio S."]] },
];

export default function Landing() {
  const { user } = useAuth();
  const ctaTo = user ? "/painel" : "/cadastro";

  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <nav aria-label="Principal">
          <a href="#recursos">Recursos</a>
          <a href="#como-funciona">Como funciona</a>
          <Link to={`/b/${DEMO_SLUG}`}>Exemplo</Link>
        </nav>
        <div className="landing-nav__actions">
          {user ? (
            <Link to="/painel" className="btn btn--primary btn--sm">
              Abrir painel
            </Link>
          ) : (
            <>
              <Link to="/entrar" className="btn btn--ghost btn--sm">
                Entrar
              </Link>
              <Link to="/cadastro" className="btn btn--primary btn--sm">
                Criar conta
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="hero__copy">
          <h1>Sua agenda cheia, sem atender o telefone.</h1>
          <p>
            O Agendaí cria uma página de agendamento para o seu negócio. O cliente escolhe o serviço, o profissional
            e o horário, e você só aparece para atender.
          </p>
          <div className="hero__actions">
            <Link to={ctaTo} className="btn btn--primary btn--lg">
              Criar minha agenda grátis
            </Link>
            <Link to={`/b/${DEMO_SLUG}`} className="btn btn--ghost btn--lg">
              Ver uma página de exemplo
            </Link>
          </div>
          <ul className="hero__proof">
            <li>
              <LuCheck aria-hidden /> Pronto em 5 minutos
            </li>
            <li>
              <LuCheck aria-hidden /> Funciona no celular
            </li>
            <li>
              <LuCheck aria-hidden /> Sem app para o cliente baixar
            </li>
          </ul>
        </div>
        <div className="hero__demo">
          <LiveBookingDemo />
        </div>
      </section>

      <section className="showcase" id="recursos">
        <div className="showcase__text">
          <h2>O dia inteiro numa tela só.</h2>
          <p>
            Cada profissional ganha uma coluna. Você vê quem está livre, quem atende agora e o que vem depois, sem
            caderno e sem planilha.
          </p>
          <ul className="feature-list">
            <li>
              <LuClock3 aria-hidden />
              <div>
                <strong>Horários calculados sozinhos</strong>
                <span>O sistema considera a duração do serviço, o almoço, as folgas e o que já está marcado.</span>
              </div>
            </li>
            <li>
              <LuLink aria-hidden />
              <div>
                <strong>Um link para a bio do Instagram</strong>
                <span>Sua página tem a sua cor, seus serviços, preços, endereço e botão do WhatsApp.</span>
              </div>
            </li>
            <li>
              <LuBellRing aria-hidden />
              <div>
                <strong>Lembrete com um clique</strong>
                <span>Mande a mensagem pronta pelo WhatsApp e diminua as faltas.</span>
              </div>
            </li>
            <li>
              <LuChartColumn aria-hidden />
              <div>
                <strong>Números que importam</strong>
                <span>Faturamento do mês, ticket médio, taxa de faltas e seus clientes mais fiéis.</span>
              </div>
            </li>
          </ul>
        </div>

        <div className="agenda-preview" aria-hidden>
          <div className="agenda-preview__head">
            <strong>Hoje</strong>
            <span>{dayjs().format("dddd, DD [de] MMMM")}</span>
          </div>
          <div className="agenda-preview__grid">
            <div className="agenda-preview__hours">
              {["09h", "10h", "11h", "12h", "13h"].map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
            {AGENDA_PREVIEW.map((col) => (
              <div key={col.name} className="agenda-preview__col" style={{ "--c": col.color }}>
                <span className="agenda-preview__name">{col.name}</span>
                <div className="agenda-preview__track">
                  {col.blocks.map(([start, size, service, client]) => (
                    <div key={start} className="agenda-preview__block" style={{ top: `${start * 10}%`, height: `${size * 10 - 1.5}%` }}>
                      <strong>{service}</strong>
                      <span>{client}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="agenda-preview__now" style={{ top: "47%" }} />
          </div>
        </div>
      </section>

      <section className="steps" id="como-funciona">
        <h2>Como começar</h2>
        <ol>
          <li>
            <span className="steps__n">1</span>
            <h3>Cadastre seu negócio</h3>
            <p>Nome, endereço e WhatsApp. Já deixamos um horário de funcionamento sugerido.</p>
          </li>
          <li>
            <span className="steps__n">2</span>
            <h3>Monte seu cardápio de serviços</h3>
            <p>Preço, duração e quem faz cada serviço. Dá para ter vários profissionais.</p>
          </li>
          <li>
            <span className="steps__n">3</span>
            <h3>Compartilhe o link</h3>
            <p>Coloque na bio, mande no WhatsApp ou imprima. Os agendamentos caem direto na sua agenda.</p>
          </li>
        </ol>
      </section>

      <section className="audience">
        <h2>Feito para quem atende com hora marcada</h2>
        <ul>
          {["Barbearias", "Salões de beleza", "Manicures", "Estúdios de tatuagem", "Clínicas de estética", "Personal trainers", "Fisioterapeutas", "Pet shops"].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="cta-band">
        <LuCalendarCheck aria-hidden className="cta-band__icon" />
        <h2>Comece hoje. Seu primeiro agendamento pode chegar ainda esta noite.</h2>
        <Link to={ctaTo} className="btn btn--mint btn--lg">
          Criar minha agenda grátis
        </Link>
      </section>

      <footer className="landing-footer">
        <Logo />
        <p>Projeto de portfólio desenvolvido com FastAPI, React e PostgreSQL.</p>
        <Link to="/entrar" className="landing-footer__link">
          Acessar o painel
        </Link>
      </footer>
    </div>
  );
}
