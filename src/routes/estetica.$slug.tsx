import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBookingProtectionConfig, submitBooking } from "@/lib/booking.functions";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { QueryError } from "@/components/QueryError";
import { CheckCircle2, Clock, MapPin, MessageCircle, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMediaUrl, type Business, type Service } from "@/lib/business";
import {
  addDaysYmd,
  bookingErrorMessage,
  fmtDateTime,
  fmtTime,
  fmtYmdLong,
  formatBRL,
  formatPhone,
  normalizePhone,
  whatsAppLink,
  ymdInTz,
} from "@/lib/detailhub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/estetica/$slug")({
  head: () => ({
    meta: [
      { title: "Agende seu serviço — DetailHub" },
      { name: "description", content: "Veja os serviços e solicite seu agendamento online." },
      { property: "og:title", content: "Agende seu serviço de estética automotiva" },
      {
        property: "og:description",
        content: "Escolha o serviço, data e horário e solicite seu agendamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicPage,
});

const PUBLIC_FIELDS =
  "id, slug, name, description, phone, whatsapp, address, logo_url, cover_url, timezone";

function PublicPage() {
  const { slug } = Route.useParams();
  const q = useQuery({
    queryKey: ["public", slug],
    queryFn: async () => {
      const { data: b, error } = await supabase
        .from("businesses")
        .select(PUBLIC_FIELDS)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!b) return null;
      const { data: s, error: servicesError } = await supabase
        .from("services")
        .select("id, name, description, price_cents, duration_minutes, image_url")
        .eq("business_id", b.id)
        .eq("is_active", true)
        .order("price_cents");
      if (servicesError) throw servicesError;
      return { b: b as Business, services: (s ?? []) as Service[] };
    },
  });
  const [booking, setBooking] = useState<Service | null>(null);
  const logo = useMediaUrl(q.data?.b.logo_url);
  const cover = useMediaUrl(q.data?.b.cover_url);

  if (q.error)
    return (
      <div className="mx-auto max-w-3xl p-6">
        <QueryError
          onRetry={() => {
            void q.refetch();
          }}
        />
      </div>
    );
  if (q.isLoading)
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-48" />
        <Skeleton className="h-24" />
      </div>
    );
  if (!q.data)
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-4xl font-bold uppercase">Estética não encontrada</h1>
          <p className="text-muted-foreground">Verifique o link.</p>
        </div>
      </div>
    );
  const { b, services } = q.data;

  return (
    <div className="min-h-screen pb-16">
      <header className="relative h-56 overflow-hidden bg-secondary sm:h-72">
        {cover && (
          <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-hero" />
        <div className="stripe-accent absolute bottom-0 h-1.5 w-full opacity-70" />
      </header>
      <div className="mx-auto -mt-16 max-w-3xl px-4">
        <div className="relative flex items-end gap-4">
          <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border-4 border-background bg-card">
            {logo ? (
              <img src={logo} alt={`Logo ${b.name}`} className="h-full w-full object-cover" />
            ) : (
              <span className="font-display text-4xl font-bold text-primary">{b.name[0]}</span>
            )}
          </div>
          <h1 className="pb-1 text-4xl font-bold uppercase leading-none sm:text-5xl">{b.name}</h1>
        </div>
        {b.description && <p className="mt-4 text-muted-foreground">{b.description}</p>}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {b.address && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4 text-primary" />
              {b.address}
            </span>
          )}
          {b.phone && (
            <span className="flex items-center gap-1.5">
              <Phone className="size-4 text-primary" />
              {b.phone}
            </span>
          )}
        </div>
        {b.whatsapp && (
          <Button asChild variant="whatsapp" className="mt-4">
            <a
              href={whatsAppLink(b.whatsapp, `Olá! Vim pela página da ${b.name}.`)}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle /> Conversar pelo WhatsApp
            </a>
          </Button>
        )}

        {booking ? (
          <BookingFlow b={b} service={booking} onBack={() => setBooking(null)} />
        ) : (
          <section className="mt-10">
            <h2 className="mb-4 text-3xl font-bold uppercase">Serviços</h2>
            {!services.length ? (
              <p className="text-muted-foreground">Nenhum serviço disponível no momento.</p>
            ) : (
              <div className="grid gap-3">
                {services.map((s) => (
                  <ServiceRow key={s.id} s={s} onBook={() => setBooking(s)} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function ServiceRow({ s, onBook }: { s: Service; onBook: () => void }) {
  const img = useMediaUrl(s.image_url);
  return (
    <div className="flex gap-4 rounded-lg border bg-card p-4">
      {img && (
        <img src={img} alt="" className="size-20 shrink-0 rounded-md object-cover" loading="lazy" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-display text-2xl font-semibold uppercase">{s.name}</p>
        {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            <span className="font-display text-xl font-bold text-primary">
              {formatBRL(s.price_cents)}
            </span>{" "}
            <span className="text-muted-foreground">
              · <Clock className="inline size-3.5" /> {s.duration_minutes} min
            </span>
          </p>
          <Button variant="hero" size="sm" onClick={onBook}>
            Solicitar agendamento
          </Button>
        </div>
      </div>
    </div>
  );
}

function BookingFlow({
  b,
  service,
  onBack,
}: {
  b: Business;
  service: Service;
  onBack: () => void;
}) {
  const tz = b.timezone;
  const today = ymdInTz(new Date(), tz);
  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => addDaysYmd(today, i)), [today]);
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<string | null>(null);
  const [step, setStep] = useState<"time" | "data" | "review" | "done">("time");
  const [form, setForm] = useState({ name: "", phone: "", model: "", plate: "", notes: "" });
  const [requestKey] = useState(() => crypto.randomUUID());
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const onToken = useCallback((value: string | null) => setToken(value), []);
  const submit = useServerFn(submitBooking);
  const protectionConfig = useServerFn(getBookingProtectionConfig);
  const protection = useQuery({
    queryKey: ["booking-protection"],
    queryFn: () => protectionConfig(),
  });

  const slots = useQuery({
    queryKey: ["slots", b.slug, service.id, date],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_available_slots", {
        _slug: b.slug,
        _service_id: service.id,
        _date: date,
      });
      if (error) throw error;
      return (data ?? []) as unknown as string[];
    },
    enabled: step === "time",
  });

  function validate(): string | null {
    if (form.name.trim().length < 2) return "Informe seu nome.";
    const p = normalizePhone(form.phone);
    if (p.length < 12 || p.length > 13) return "Informe um WhatsApp válido com DDD.";
    if (form.model.trim().length < 2) return "Informe o modelo do veículo.";
    return null;
  }

  async function send() {
    if (sending || !slot || !token) return;
    setSending(true);
    setErr(null);
    try {
      const result = await submit({
        data: {
          slug: b.slug,
          serviceId: service.id,
          startsAt: slot,
          name: form.name,
          phone: form.phone,
          vehicleModel: form.model,
          plate: form.plate,
          notes: form.notes,
          requestKey,
          turnstileToken: token,
        },
      });
      if (result.error || !result.id) {
        setErr(bookingErrorMessage(result.error));
        if (result.error?.includes("HORARIO_INDISPONIVEL")) {
          setSlot(null);
          setStep("time");
          void slots.refetch();
        }
        return;
      }
      setStep("done");
    } catch {
      setErr(bookingErrorMessage(undefined));
    } finally {
      setSending(false);
      setToken(null);
      setResetKey((value) => value + 1);
    }
  }

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [k]: e.target.value });

  if (step === "done") {
    return (
      <div className="mt-10 rounded-lg border border-success/50 bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto size-12 text-success" />
        <h2 className="mt-3 text-3xl font-bold uppercase">Solicitação enviada!</h2>
        <p className="mt-2 text-muted-foreground">
          Seu agendamento está aguardando aprovação da estética. A confirmação será feita pelo
          WhatsApp.
        </p>
        <Button variant="outline" className="mt-5" onClick={onBack}>
          Voltar aos serviços
        </Button>
      </div>
    );
  }

  return (
    <section className="mt-10 space-y-5">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
        ← Trocar serviço
      </button>
      <div className="rounded-lg border border-primary/40 bg-card p-4">
        <p className="font-display text-2xl font-semibold uppercase">{service.name}</p>
        <p className="text-sm text-muted-foreground">
          {formatBRL(service.price_cents)} · {service.duration_minutes} min
        </p>
      </div>
      {err && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {err}
        </p>
      )}

      {step === "time" && (
        <>
          <div>
            <h3 className="mb-2 text-xl font-semibold uppercase">1. Escolha a data</h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {days.map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setDate(d);
                    setSlot(null);
                  }}
                  className={cn(
                    "flex w-16 shrink-0 flex-col items-center rounded-md border p-2 text-sm",
                    d === date
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card hover:border-primary/60",
                  )}
                >
                  <span className="text-xs uppercase">{fmtYmdLong(d).slice(0, 3)}</span>
                  <span className="font-display text-xl font-bold">{d.slice(8)}</span>
                  <span className="text-xs">{d.slice(5, 7)}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-xl font-semibold uppercase">2. Horários disponíveis</h3>
            {slots.isLoading ? (
              <p className="text-sm text-muted-foreground">Consultando horários...</p>
            ) : slots.error ? (
              <QueryError
                onRetry={() => {
                  void slots.refetch();
                }}
              />
            ) : !slots.data?.length ? (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Sem horários livres nesta data. Escolha outro dia.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {slots.data.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSlot(s)}
                    className={cn(
                      "rounded-md border py-2 font-semibold",
                      slot === s
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card hover:border-primary/60",
                    )}
                  >
                    {fmtTime(s, tz)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            variant="hero"
            size="lg"
            className="w-full"
            disabled={!slot}
            onClick={() => {
              setErr(null);
              setStep("data");
            }}
          >
            Continuar
          </Button>
        </>
      )}

      {step === "data" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const v = validate();
            if (v) return setErr(v);
            setErr(null);
            setStep("review");
          }}
        >
          <h3 className="text-xl font-semibold uppercase">3. Seus dados</h3>
          <div className="space-y-1">
            <Label htmlFor="bn">Nome</Label>
            <Input
              id="bn"
              value={form.name}
              onChange={set("name")}
              required
              maxLength={120}
              autoComplete="name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bp">WhatsApp</Label>
            <Input
              id="bp"
              value={form.phone}
              onChange={set("phone")}
              required
              inputMode="tel"
              placeholder="(11) 98765-4321"
              autoComplete="tel"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="bm">Modelo do veículo</Label>
              <Input
                id="bm"
                value={form.model}
                onChange={set("model")}
                required
                maxLength={80}
                placeholder="Ex.: Onix"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bl">Placa (opcional)</Label>
              <Input id="bl" value={form.plate} onChange={set("plate")} maxLength={10} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="bo">Observação (opcional)</Label>
            <Textarea id="bo" value={form.notes} onChange={set("notes")} maxLength={1000} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("time")}>
              Voltar
            </Button>
            <Button type="submit" variant="hero" className="flex-1">
              Revisar
            </Button>
          </div>
        </form>
      )}

      {step === "review" && slot && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold uppercase">4. Confira os dados</h3>
          <dl className="grid gap-2 rounded-lg border bg-card p-4 text-sm">
            <Row k="Serviço" v={`${service.name} · ${formatBRL(service.price_cents)}`} />
            <Row k="Data e horário" v={fmtDateTime(slot, tz)} />
            <Row k="Nome" v={form.name} />
            <Row k="WhatsApp" v={formatPhone(normalizePhone(form.phone))} />
            <Row
              k="Veículo"
              v={`${form.model}${form.plate ? ` · ${form.plate.toUpperCase()}` : ""}`}
            />
            {form.notes && <Row k="Observação" v={form.notes} />}
          </dl>
          <p className="text-xs text-muted-foreground">
            O envio é uma solicitação. O agendamento só estará confirmado após a aprovação da
            estética.
          </p>
          {protection.error ? (
            <QueryError
              onRetry={() => {
                void protection.refetch();
              }}
            />
          ) : protection.isPending ? (
            <p className="text-muted-foreground">Carregando verificação...</p>
          ) : protection.data?.siteKey ? (
            <TurnstileWidget
              siteKey={protection.data.siteKey}
              resetKey={resetKey}
              onToken={onToken}
            />
          ) : (
            <p role="alert" className="text-destructive">
              Novas solicitações estão temporariamente indisponíveis. Entre em contato com a
              estética.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("data")} disabled={sending}>
              Voltar
            </Button>
            <Button
              variant="hero"
              size="lg"
              className="flex-1"
              onClick={send}
              disabled={sending || !token}
            >
              {sending ? "Enviando..." : err ? "Tentar novamente" : "Enviar solicitação"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
