import { QueryError } from "@/components/QueryError";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  Gauge,
  LogOut,
  Settings,
  Users,
  Wrench,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMyBusiness } from "@/lib/business";
import { slugify } from "@/lib/detailhub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "../index";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — DetailHub" },
      { name: "description", content: "Gerencie serviços, agenda e clientes da sua estética." },
      { property: "og:title", content: "Painel — DetailHub" },
      { property: "og:description", content: "Painel do proprietário." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PanelLayout,
});

const NAV = [
  { to: "/painel", label: "Visão geral", icon: Gauge, exact: true },
  { to: "/painel/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/painel/agendamentos", label: "Agendamentos", icon: ClipboardList },
  { to: "/painel/servicos", label: "Serviços", icon: Wrench },
  { to: "/painel/clientes", label: "Clientes", icon: Users },
  { to: "/painel/configuracoes", label: "Configurações", icon: Settings },
] as const;

function PanelLayout() {
  const { data: business, isLoading, error, refetch } = useMyBusiness();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading)
    return (
      <div className="p-8">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  if (error)
    return (
      <div className="p-8">
        <QueryError
          onRetry={() => {
            void refetch();
          }}
        />
      </div>
    );
  if (!business) return <CreateBusiness onSignOut={signOut} />;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 z-20 border-b bg-sidebar md:h-screen md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-4 md:block">
          <Logo />
          <p className="mt-0 truncate text-xs text-muted-foreground md:mt-3">{business.name}</p>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0"
          aria-label="Menu do painel"
        >
          {NAV.map(({ to, label, icon: I, ...rest }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: "exact" in rest }}
              className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              activeProps={{ className: "bg-sidebar-accent text-primary font-semibold" }}
            >
              <I className="size-4" /> {label}
            </Link>
          ))}
        </nav>
        <div className="hidden space-y-1 px-2 pt-6 md:block">
          <a
            href={`/estetica/${business.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="size-4" /> Ver página pública
          </a>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-4" /> Sair
          </button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
        <Outlet />
        <button
          onClick={signOut}
          className="mt-10 flex items-center gap-2 text-sm text-muted-foreground md:hidden"
        >
          <LogOut className="size-4" /> Sair
        </button>
      </main>
    </div>
  );
}

function CreateBusiness({ onSignOut }: { onSignOut: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const s = slugify(slug || name);
    if (s.length < 3) {
      toast.error("O link precisa ter pelo menos 3 caracteres.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.rpc("create_business", { _name: name, _slug: s });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.includes("duplicate")
          ? "Esse link já está em uso. Escolha outro."
          : error.message,
      );
      return;
    }
    toast.success("Estética criada! Vamos completar a configuração.");
    qc.invalidateQueries({ queryKey: ["my-business"] });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-8">
        <Logo />
      </div>
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Passo 1 de 5</p>
        <h1 className="text-3xl font-bold uppercase">Cadastre sua estética</h1>
        <div className="space-y-1.5">
          <Label htmlFor="bname">Nome comercial</Label>
          <Input
            id="bname"
            value={name}
            required
            minLength={2}
            onChange={(e) => {
              setName(e.target.value);
              if (!touched) setSlug(slugify(e.target.value));
            }}
            placeholder="Ex.: Auto Brilho"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bslug">Link público</Label>
          <div className="flex items-center rounded-md border bg-input/20 pl-3 text-sm text-muted-foreground">
            /estetica/
            <Input
              id="bslug"
              className="border-0 bg-transparent pl-1 shadow-none focus-visible:ring-0"
              value={slug}
              onChange={(e) => {
                setTouched(true);
                setSlug(slugify(e.target.value));
              }}
              required
            />
          </div>
        </div>
        <Button type="submit" variant="hero" className="w-full" disabled={loading}>
          {loading ? "Criando..." : "Continuar"}
        </Button>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full text-center text-sm text-muted-foreground hover:underline"
        >
          Sair
        </button>
      </form>
    </div>
  );
}
