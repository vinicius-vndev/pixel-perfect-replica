// Pure helpers shared by the public page and the owner panel (no I/O).

export type AppointmentStatus =
  | "pendente"
  | "confirmado"
  | "recusado"
  | "cancelado"
  | "concluido"
  | "nao_compareceu";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  recusado: "Recusado",
  cancelado: "Cancelado",
  concluido: "Concluído",
  nao_compareceu: "Não compareceu",
};

/** Mirrors the server rule in change_appointment_status (server is the authority). */
export const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pendente: ["confirmado", "recusado", "cancelado"],
  confirmado: ["concluido", "cancelado", "nao_compareceu"],
  recusado: [],
  cancelado: [],
  concluido: [],
  nao_compareceu: [],
};

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(cents / 100)
    .replace(/\u00a0/g, " ");
}

/** "80,00" | "80" | "1.200,50" -> cents */
export function parseBRLToCents(input: string): number | null {
  const clean = input.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(parseFloat(clean) * 100);
}

/** Same rule as public.normalize_phone in the database. */
export function normalizePhone(p: string): string {
  const d = (p || "").replace(/\D/g, "");
  return d.length === 10 || d.length === 11 ? "55" + d : d;
}

export function formatPhone(p: string | null | undefined): string {
  if (!p) return "";
  const d = p.replace(/\D/g, "");
  const local = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return p;
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ---------- Time zone helpers ----------
function tzOffsetMinutes(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return (asUTC - date.getTime()) / 60000;
}

/** Local wall-clock (YYYY-MM-DD, HH:mm) in tz -> UTC Date */
export function zonedToUtc(ymd: string, hm: string, tz: string): Date {
  const [y = 0, m = 1, d = 1] = ymd.split("-").map(Number);
  const [h = 0, mi = 0] = hm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const off = tzOffsetMinutes(new Date(guess), tz);
  return new Date(guess - off * 60000);
}

export function ymdInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(date);
}

export function addDaysYmd(ymd: string, n: number): string {
  const [y = 0, m = 1, d = 1] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function weekdayOfYmd(ymd: string): number {
  const [y = 0, m = 1, d = 1] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function fmtTime(iso: string | Date, tz: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}
export function fmtDate(iso: string | Date, tz: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    ...(opts ?? {}),
  }).format(new Date(iso));
}
export function fmtDateTime(iso: string | Date, tz: string): string {
  return `${fmtDate(iso, tz, { year: "numeric" })} às ${fmtTime(iso, tz)}`;
}
export function fmtYmdLong(ymd: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(ymd + "T12:00:00Z"));
}

/** "14h" for whole hours, "14h30" otherwise */
function hourLabel(iso: string, tz: string): string {
  const [h, m] = fmtTime(iso, tz).split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

export function buildWhatsAppConfirmation(input: {
  customerName: string;
  businessName: string;
  serviceName: string;
  startsAt: string;
  priceCents: number;
  address: string | null;
  timezone: string;
}): string {
  const first = input.customerName.trim().split(/\s+/)[0] ?? "";
  const date = fmtDate(input.startsAt, input.timezone);
  const parts = [
    `Olá, ${first}! Seu agendamento na ${input.businessName} foi confirmado para ${date} às ${hourLabel(input.startsAt, input.timezone)}.`,
    `Serviço: ${input.serviceName.toLowerCase()}.`,
    `Valor: ${formatBRL(input.priceCents)}.`,
  ];
  if (input.address) parts.push(`Endereço: ${input.address}.`);
  parts.push("Até lá!");
  return parts.join(" ");
}

export function whatsAppLink(phone: string, text?: string): string {
  const n = normalizePhone(phone);
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

const BOOKING_ERRORS: Record<string, string> = {
  HORARIO_INDISPONIVEL: "Esse horário acabou de ser reservado ou não está mais disponível. Escolha outro horário.",
  SERVICO_INDISPONIVEL: "Este serviço não está mais disponível.",
  ESTETICA_NAO_ENCONTRADA: "Estética não encontrada.",
  NOME_INVALIDO: "Informe seu nome completo.",
  TELEFONE_INVALIDO: "Informe um WhatsApp válido com DDD.",
  VEICULO_INVALIDO: "Informe o modelo do veículo.",
  PLACA_INVALIDA: "Placa inválida.",
  OBSERVACAO_LONGA: "A observação está muito longa.",
  LIMITE_SOLICITACOES: "Muitas solicitações recentes. Aguarde a resposta da estética ou tente mais tarde.",
};
export function bookingErrorMessage(raw: string | undefined): string {
  if (!raw) return "Não foi possível enviar. Verifique sua conexão e tente novamente.";
  const key = Object.keys(BOOKING_ERRORS).find((k) => raw.includes(k));
  return key ? (BOOKING_ERRORS[key] ?? "") : "Não foi possível enviar. Verifique sua conexão e tente novamente.";
}
