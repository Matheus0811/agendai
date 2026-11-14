import dayjs from "dayjs";
import "dayjs/locale/pt-br";

dayjs.locale("pt-br");

export { dayjs };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const formatMoney = (cents = 0) => money.format((cents || 0) / 100);

export function parseMoneyToCents(text) {
  const clean = String(text).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const value = Number.parseFloat(clean);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export const centsToInput = (cents = 0) => ((cents || 0) / 100).toFixed(2).replace(".", ",");

export const onlyDigits = (value = "") => String(value).replace(/\D/g, "");

export function formatPhone(value = "") {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function whatsappLink(phone, text = "") {
  let digits = onlyDigits(phone);
  if (!digits) return null;
  if (digits.length <= 11) digits = `55${digits}`;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

export const hhmm = (value = "") => String(value).slice(0, 5);

export const toISODate = (value) => dayjs(value).format("YYYY-MM-DD");

export const formatDuration = (minutes) => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
};

export const capitalize = (text = "") => text.charAt(0).toUpperCase() + text.slice(1);

// 0 = segunda ... 6 = domingo (mesmo padrão do back-end)
export const WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
export const WEEKDAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const backendWeekday = (date) => (dayjs(date).day() + 6) % 7;

export const STATUS = {
  confirmed: { label: "Confirmado", tone: "violet" },
  completed: { label: "Concluído", tone: "mint" },
  cancelled: { label: "Cancelado", tone: "muted" },
  no_show: { label: "Faltou", tone: "amber" },
};

export const PALETTE = ["#5B47E0", "#E2674A", "#17996F", "#E9A227", "#2F7DE1", "#C93F8B", "#C08A2E", "#1D1B3F"];

function calendarStamp(date) {
  return dayjs(date).format("YYYYMMDD[T]HHmmss");
}

export function googleCalendarLink({ title, start, end, details = "", location = "" }) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${calendarStamp(start)}/${calendarStamp(end)}`,
    details,
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadIcs({ title, start, end, details = "", location = "", filename = "agendamento.ics" }) {
  const escape = (text) => String(text).replace(/[,;\\]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Agendai//PT-BR",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@agendai`,
    `DTSTAMP:${calendarStamp(new Date())}`,
    `DTSTART:${calendarStamp(start)}`,
    `DTEND:${calendarStamp(end)}`,
    `SUMMARY:${escape(title)}`,
    `DESCRIPTION:${escape(details)}`,
    `LOCATION:${escape(location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
