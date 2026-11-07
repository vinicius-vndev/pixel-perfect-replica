import { pageHead } from "@/lib/page-head";
import { QueryError } from "@/components/QueryError";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { formatPhone } from "@/lib/detailhub";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/painel/clientes/")({ head: () => pageHead("Clientes", "Consulte os clientes da sua estética."), component: Customers });

function Customers() {
  const b = useBusiness();
  const [term, setTerm] = useState("");
  const q = useQuery({
    queryKey: ["customers", b.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name, phone, vehicles(model)").eq("business_id", b.id).order("name");
      if (error) throw error;
      return data;
    },
  });
  const t = term.toLowerCase().trim();
  const d = t.replace(/\D/g, "");
  const items = (q.data ?? []).filter((c) => !t || c.name.toLowerCase().includes(t) || (d.length >= 3 && c.phone.includes(d)));
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold uppercase">Clientes</h1>
      <Input placeholder="Buscar por nome ou telefone" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Buscar cliente" />
      {q.error ? <QueryError onRetry={() => { void q.refetch(); }} /> : q.isLoading ? <p className="text-muted-foreground">Carregando...</p> : !items.length ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">Nenhum cliente encontrado. Eles aparecem aqui ao enviar um pedido.</p>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {items.map((c) => (
            <Link key={c.id} to="/painel/clientes/$id" params={{ id: c.id }} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-accent">
              <div><p className="font-semibold">{c.name}</p><p className="text-sm text-muted-foreground">{formatPhone(c.phone)}</p></div>
              <p className="text-sm text-muted-foreground">{c.vehicles.map((v) => v.model).join(", ")}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
