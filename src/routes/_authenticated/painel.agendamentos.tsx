import { pageHead } from "@/lib/page-head";
import { QueryError } from "@/components/QueryError";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { addDaysYmd, STATUS_LABEL, ymdInTz, zonedToUtc, type AppointmentStatus } from "@/lib/detailhub";
import { AppointmentCard, APPOINTMENT_SELECT, type AppointmentRow } from "@/components/AppointmentCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/painel/agendamentos")({ head: () => pageHead("Agendamentos", "Consulte solicitações e acompanhe seus agendamentos."), component: Appointments });

function Appointments() {
  const b = useBusiness();
  const tz = b.timezone;
  const today = ymdInTz(new Date(), tz);
  const [from, setFrom] = useState(addDaysYmd(today, -30));
  const [to, setTo] = useState(addDaysYmd(today, 60));
  const [status, setStatus] = useState<AppointmentStatus | "todos">("todos");
  const [client, setClient] = useState("");

  const q = useQuery({
    queryKey: ["appointments", "list", b.id, from, to, status],
    queryFn: async () => {
      let query = supabase.from("appointments").select(APPOINTMENT_SELECT).eq("business_id", b.id)
        .gte("starts_at", zonedToUtc(from, "00:00", tz).toISOString())
        .lt("starts_at", zonedToUtc(addDaysYmd(to, 1), "00:00", tz).toISOString())
        .order("starts_at", { ascending: false }).limit(500);
      if (status !== "todos") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as AppointmentRow[];
    },
  });

  const term = client.trim().toLowerCase();
  const digits = term.replace(/\D/g, "");
  const items = (q.data ?? []).filter((a) => !term || a.customers?.name.toLowerCase().includes(term) || (digits.length >= 3 && a.customers?.phone.includes(digits)));

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold uppercase">Agendamentos</h1>
      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-4">
        <div className="space-y-1"><Label htmlFor="f">De</Label><Input id="f" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="t">Até</Label><Input id="t" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label htmlFor="c">Cliente</Label><Input id="c" placeholder="Nome ou telefone" value={client} onChange={(e) => setClient(e.target.value)} /></div>
      </div>
      {q.isLoading ? <p className="text-muted-foreground">Carregando...</p> : q.error ? <QueryError onRetry={() => { void q.refetch(); }} /> : !items.length ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">Nenhum agendamento encontrado.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">{items.map((a) => <AppointmentCard key={a.id} a={a} business={b} />)}</div>
      )}
    </div>
  );
}
