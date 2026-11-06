import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Copy, Circle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { addDaysYmd, formatBRL, ymdInTz, zonedToUtc } from "@/lib/detailhub";
import { AppointmentCard, APPOINTMENT_SELECT, type AppointmentRow } from "@/components/AppointmentCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/painel/")({ component: Overview });

function Overview() {
  const b = useBusiness();
  const tz = b.timezone;
  const today = ymdInTz(new Date(), tz);
  const [period, setPeriod] = useState<"7" | "30" | "month">("month");

  const setup = useQuery({
    queryKey: ["setup", b.id],
    queryFn: async () => {
      const [h, s] = await Promise.all([
        supabase.from("business_hours").select("id").eq("business_id", b.id).eq("is_open", true),
        supabase.from("services").select("id").eq("business_id", b.id).eq("is_active", true),
      ]);
      return { hours: (h.data?.length ?? 0) > 0, services: (s.data?.length ?? 0) > 0 };
    },
  });

  const lists = useQuery({
    queryKey: ["appointments", "overview", b.id, today],
    queryFn: async () => {
      const start = zonedToUtc(today, "00:00", tz).toISOString();
      const end = zonedToUtc(addDaysYmd(today, 1), "00:00", tz).toISOString();
      const weekEnd = zonedToUtc(addDaysYmd(today, 8), "00:00", tz).toISOString();
      const [t, p, u] = await Promise.all([
        supabase.from("appointments").select(APPOINTMENT_SELECT).eq("business_id", b.id).gte("starts_at", start).lt("starts_at", end).in("status", ["pendente", "confirmado", "concluido", "nao_compareceu"]).order("starts_at"),
        supabase.from("appointments").select(APPOINTMENT_SELECT).eq("business_id", b.id).eq("status", "pendente").gte("starts_at", new Date().toISOString()).order("starts_at"),
        supabase.from("appointments").select(APPOINTMENT_SELECT).eq("business_id", b.id).eq("status", "confirmado").gte("starts_at", end).lt("starts_at", weekEnd).order("starts_at").limit(10),
      ]);
      if (t.error || p.error || u.error) throw t.error || p.error || u.error;
      return { today: t.data as unknown as AppointmentRow[], pending: p.data as unknown as AppointmentRow[], upcoming: u.data as unknown as AppointmentRow[] };
    },
  });

  const stats = useQuery({
    queryKey: ["appointments", "stats", b.id, period, today],
    queryFn: async () => {
      const from = period === "month" ? today.slice(0, 8) + "01" : addDaysYmd(today, -Number(period) + 1);
      const { data, error } = await supabase.from("appointments").select("price_cents").eq("business_id", b.id).eq("status", "concluido")
        .gte("starts_at", zonedToUtc(from, "00:00", tz).toISOString()).lt("starts_at", zonedToUtc(addDaysYmd(today, 1), "00:00", tz).toISOString());
      if (error) throw error;
      return { count: data.length, total: data.reduce((s, r) => s + r.price_cents, 0) };
    },
  });

  const link = typeof window !== "undefined" ? `${window.location.origin}/estetica/${b.slug}` : `/estetica/${b.slug}`;
  const steps = [
    { done: true, label: "Cadastrar a estética", to: "/painel/configuracoes" },
    { done: !!b.address && !!b.description, label: "Completar descrição e endereço", to: "/painel/configuracoes" },
    { done: !!setup.data?.hours, label: "Definir horários de funcionamento", to: "/painel/configuracoes" },
    { done: !!setup.data?.services, label: "Adicionar serviços", to: "/painel/servicos" },
    { done: !!b.whatsapp, label: "Configurar o WhatsApp", to: "/painel/configuracoes" },
  ] as const;
  const incomplete = setup.data && steps.some((s) => !s.done);

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold uppercase">Visão geral</h1>

      {incomplete && (
        <section className="rounded-lg border border-primary/50 bg-card p-5">
          <h2 className="text-2xl font-semibold uppercase">Configuração inicial</h2>
          <p className="text-sm text-muted-foreground">Complete os itens abaixo para começar a receber pedidos.</p>
          <ul className="mt-4 space-y-2">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-sm">
                {s.done ? <Check className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />}
                {s.done ? <span className="text-muted-foreground line-through">{s.label}</span> : <Link to={s.to} className="font-medium text-primary hover:underline">{s.label}</Link>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Seu link público</p>
          <p className="truncate font-medium">{link}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado!"); }}><Copy /> Copiar</Button>
        <Button asChild size="sm"><a href={link} target="_blank" rel="noreferrer">Abrir</a></Button>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Solicitações pendentes" value={lists.data?.pending.length ?? "–"} highlight />
        <Stat label="Serviços concluídos" value={stats.data?.count ?? "–"} />
        <Stat label="Valor dos serviços concluídos" value={stats.data ? formatBRL(stats.data.total) : "–"} hint="Não representa pagamentos recebidos." />
        <div className="sm:col-span-3 -mt-2 flex justify-end">
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger className="w-44" aria-label="Período"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <Block title="Solicitações pendentes" empty="Nenhuma solicitação aguardando aprovação." loading={lists.isLoading} items={lists.data?.pending} b={b} />
      <Block title="Agendamentos de hoje" empty="Nenhum atendimento hoje." loading={lists.isLoading} items={lists.data?.today} b={b} showDate={false} />
      <Block title="Próximos atendimentos" empty="Nenhum atendimento confirmado nos próximos dias." loading={lists.isLoading} items={lists.data?.upcoming} b={b} />
    </div>
  );
}

function Stat({ label, value, hint, highlight }: { label: string; value: React.ReactNode; hint?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border bg-card p-4 ${highlight ? "border-status-pendente/50" : ""}`}>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-4xl font-bold ${highlight ? "text-status-pendente" : ""}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Block({ title, empty, loading, items, b, showDate }: { title: string; empty: string; loading: boolean; items?: AppointmentRow[] | undefined; b: ReturnType<typeof useBusiness>; showDate?: boolean | undefined }) {
  return (
    <section>
      <h2 className="mb-3 text-2xl font-semibold uppercase">{title}</h2>
      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : !items?.length ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{empty}</p> : (
        <div className="grid gap-3 lg:grid-cols-2">{items.map((a) => <AppointmentCard key={a.id} a={a} business={b} showDate={showDate} />)}</div>
      )}
    </section>
  );
}
