import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import hero from "@/assets/hero-detailing.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DetailHub — Agendamento online para estéticas automotivas" },
      {
        name: "description",
        content:
          "Página própria, agenda sem conflitos e confirmação pelo WhatsApp para sua estética automotiva.",
      },
      { property: "og:title", content: "DetailHub — Agendamento para estéticas automotivas" },
      {
        property: "og:description",
        content: "Receba pedidos de agendamento online e gerencie sua estética em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <header className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <Logo />
          <Button asChild variant="outline" size="sm">
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </header>

      <section className="relative flex min-h-[88vh] items-end overflow-hidden">
        <img
          src={hero}
          alt="Carro sendo polido em estúdio de estética"
          width={1600}
          height={912}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-hero" />
        <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-32">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-background/60 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="size-3.5" /> Para estéticas automotivas
          </p>
          <h1 className="max-w-3xl text-5xl font-bold uppercase leading-[0.95] sm:text-7xl">
            Sua agenda brilhando <span className="text-primary">como o carro do cliente</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Página própria com seus serviços, pedidos de agendamento sem conflito de horário e
            confirmação pelo WhatsApp.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>
                Criar minha estética
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/auth">Já tenho conta</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-20 md:grid-cols-3">
        {[
          {
            icon: CalendarCheck,
            t: "Agenda sem conflitos",
            d: "Horários livres calculados pelo expediente, intervalos e duração de cada serviço.",
          },
          {
            icon: MessageCircle,
            t: "Confirmação no WhatsApp",
            d: "Aprove o pedido e envie a mensagem pronta com data, serviço e valor.",
          },
          {
            icon: ShieldCheck,
            t: "Seus dados, só seus",
            d: "Cada estética acessa apenas seus próprios clientes e agendamentos.",
          },
        ].map(({ icon: I, t, d }) => (
          <div key={t} className="rounded-lg border bg-card p-6">
            <I className="mb-4 size-7 text-primary" />
            <h3 className="text-2xl font-semibold uppercase">{t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        DetailHub © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-md bg-gradient-primary font-display text-lg font-bold text-primary-foreground">
        D
      </span>
      <span className="font-display text-2xl font-bold uppercase tracking-wide">
        Detail<span className="text-primary">Hub</span>
      </span>
    </Link>
  );
}
