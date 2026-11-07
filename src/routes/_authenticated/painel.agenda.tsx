import { pageHead } from "@/lib/page-head";
import { QueryError } from "@/components/QueryError";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { addDaysYmd, fmtTime, fmtYmdLong, weekdayOfYmd, ymdInTz, zonedToUtc } from "@/lib/detailhub";
import { AppointmentCard, APPOINTMENT_SELECT, type AppointmentRow } from "@/components/AppointmentCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/painel/agenda")({ head: () => pageHead("Agenda", "Consulte os atendimentos por dia e semana."), component: Agenda });

function Agenda() {
  const b = useBusiness();
  const tz = b.timezone;
  const [view, setView] = useState<"dia" | "semana">("dia");
  const [day, setDay] = useState(() => ymdInTz(new Date(), tz));
  const start = view === "dia" ? day : addDaysYmd(day, -((weekdayOfYmd(day) + 6) % 7));
  const days = view === "dia" ? 1 : 7;

  const q = useQuery({
    queryKey: ["appointments", "agenda", b.id, start, days],
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments").select(APPOINTMENT_SELECT).eq("business_id", b.id)
        .gte("starts_at", zonedToUtc(start, "00:00", tz).toISOString())
        .lt("starts_at", zonedToUtc(addDaysYmd(start, days), "00:00", tz).toISOString())
        .not("status", "in", "(recusado,cancelado)").order("starts_at");
      if (error) throw error;
      return data as unknown as AppointmentRow[];
    },
  });

  const shift = (n: number) => setDay(addDaysYmd(day, n * days));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-bold uppercase">Agenda</h1>
        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
          <TabsList><TabsTrigger value="dia">Dia</TabsTrigger><TabsTrigger value="semana">Semana</TabsTrigger></TabsList>
        </Tabs>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Anterior"><ChevronLeft /></Button>
        <Button variant="outline" size="sm" onClick={() => setDay(ymdInTz(new Date(), tz))}>Hoje</Button>
        <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Próximo"><ChevronRight /></Button>
        <p className="ml-2 font-medium capitalize">{view === "dia" ? fmtYmdLong(day) : `${fmtYmdLong(start)} – ${fmtYmdLong(addDaysYmd(start, 6))}`}</p>
      </div>

      {q.error ? <QueryError onRetry={() => { void q.refetch(); }} /> : q.isLoading ? <p className="text-muted-foreground">Carregando...</p> : view === "dia" ? (
        !q.data?.length ? <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">Nenhum atendimento neste dia.</p> :
          <div className="grid gap-3">{q.data.map((a) => <AppointmentCard key={a.id} a={a} business={b} showDate={false} />)}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDaysYmd(start, i)).map((d) => {
            const items = (q.data ?? []).filter((a) => ymdInTz(new Date(a.starts_at), tz) === d);
            return (
              <button key={d} onClick={() => { setDay(d); setView("dia"); }} className="min-h-28 rounded-lg border bg-card p-2 text-left hover:border-primary/60">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{fmtYmdLong(d).split(",")[0]}</p>
                <p className="font-display text-xl font-bold">{d.slice(8)}/{d.slice(5, 7)}</p>
                <div className="mt-2 space-y-1">
                  {items.map((a) => (
                    <div key={a.id} className="rounded bg-muted p-1.5 text-xs">
                      <p className="font-semibold">{fmtTime(a.starts_at, tz)} · {a.service_name}</p>
                      <StatusBadge status={a.status} className="mt-1 px-1.5 text-[10px]" />
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
