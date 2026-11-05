import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Car, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { formatBRL, formatPhone, whatsAppLink } from "@/lib/detailhub";
import { AppointmentCard, APPOINTMENT_SELECT, type AppointmentRow } from "@/components/AppointmentCard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/painel/clientes/$id")({ component: CustomerPage });

function CustomerPage() {
  const { id } = Route.useParams();
  const b = useBusiness();
  const q = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const [c, v, a] = await Promise.all([
        supabase.from("customers").select("*").eq("id", id).eq("business_id", b.id).maybeSingle(),
        supabase.from("vehicles").select("*").eq("customer_id", id),
        supabase.from("appointments").select(APPOINTMENT_SELECT).eq("customer_id", id).order("starts_at", { ascending: false }),
      ]);
      if (c.error || v.error || a.error) throw c.error || v.error || a.error;
      return { customer: c.data, vehicles: v.data, appts: a.data as unknown as AppointmentRow[] };
    },
  });
  if (q.isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!q.data?.customer) return <p>Cliente não encontrado.</p>;
  const { customer, vehicles, appts } = q.data;
  const done = appts.filter((a) => a.status === "concluido");
  return (
    <div className="space-y-6">
      <Link to="/painel/clientes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Clientes</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold uppercase">{customer.name}</h1>
          <p className="text-muted-foreground">{formatPhone(customer.phone)}</p>
        </div>
        <Button asChild variant="whatsapp"><a href={whatsAppLink(customer.phone)} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a></Button>
      </div>
      <section>
        <h2 className="mb-2 text-2xl font-semibold uppercase">Veículos</h2>
        <div className="flex flex-wrap gap-2">{vehicles.map((v) => <span key={v.id} className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm"><Car className="size-4 text-primary" />{v.model}{v.plate ? ` · ${v.plate}` : ""}</span>)}</div>
      </section>
      <section>
        <h2 className="mb-2 text-2xl font-semibold uppercase">Serviços realizados</h2>
        {done.length ? <p className="text-sm">{done.length} serviço(s) concluído(s) · {formatBRL(done.reduce((s, a) => s + a.price_cents, 0))} — {[...new Set(done.map((a) => a.service_name))].join(", ")}</p> : <p className="text-sm text-muted-foreground">Nenhum serviço concluído ainda.</p>}
      </section>
      <section>
        <h2 className="mb-2 text-2xl font-semibold uppercase">Histórico de agendamentos</h2>
        <div className="grid gap-3 lg:grid-cols-2">{appts.map((a) => <AppointmentCard key={a.id} a={a} business={b} />)}</div>
      </section>
    </div>
  );
}
