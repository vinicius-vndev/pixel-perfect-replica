import { pageHead } from "@/lib/page-head";
import { QueryError } from "@/components/QueryError";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadMedia, useBusiness, useMediaUrl, type BusinessHour } from "@/lib/business";
import { fmtDateTime, WEEKDAYS, zonedToUtc } from "@/lib/detailhub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/painel/configuracoes")({
  head: () => pageHead("Configurações", "Gerencie os dados e horários da sua estética."),
  component: Settings,
});

function Settings() {
  return (
    <div className="space-y-10">
      <h1 className="text-4xl font-bold uppercase">Configurações</h1>
      <BusinessForm />
      <HoursForm />
      <Blocks />
    </div>
  );
}

function BusinessForm() {
  const b = useBusiness();
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: b.name,
    description: b.description ?? "",
    phone: b.phone ?? "",
    whatsapp: b.whatsapp ?? "",
    address: b.address ?? "",
    logo_url: b.logo_url,
    cover_url: b.cover_url,
  });
  const [saving, setSaving] = useState(false);
  const logo = useMediaUrl(f.logo_url);
  const cover = useMediaUrl(f.cover_url);
  const set =
    (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const wa = f.whatsapp.replace(/\D/g, "");
    if (wa && (wa.length < 10 || wa.length > 13)) {
      toast.error("WhatsApp inválido. Use DDD + número.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("businesses")
      .update({
        name: f.name.trim(),
        description: f.description.trim() || null,
        phone: f.phone.trim() || null,
        whatsapp: wa || null,
        address: f.address.trim() || null,
        logo_url: f.logo_url,
        cover_url: f.cover_url,
      })
      .eq("id", b.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    toast.success("Dados salvos.");
    qc.invalidateQueries({ queryKey: ["my-business"] });
  }
  async function upload(kind: "logo_url" | "cover_url", file?: File) {
    if (!file) return;
    try {
      setF((p) => ({ ...p, [kind]: null }));
      const path = await uploadMedia(b.id, file, kind === "logo_url" ? "logo" : "cover");
      setF((p) => ({ ...p, [kind]: path }));
      toast.info("Imagem enviada. Clique em salvar.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-lg border bg-card p-5">
      <h2 className="text-2xl font-semibold uppercase">Dados da estética</h2>
      <p className="text-sm text-muted-foreground">Link público: /estetica/{b.slug}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="n">Nome comercial</Label>
          <Input id="n" value={f.name} onChange={set("name")} required />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="d">Descrição</Label>
          <Textarea id="d" value={f.description} onChange={set("description")} maxLength={2000} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="p">Telefone</Label>
          <Input id="p" value={f.phone} onChange={set("phone")} inputMode="tel" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="w">WhatsApp (com DDD)</Label>
          <Input
            id="w"
            value={f.whatsapp}
            onChange={set("whatsapp")}
            inputMode="tel"
            placeholder="11987654321"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="a">Endereço</Label>
          <Input id="a" value={f.address} onChange={set("address")} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="l">Logo</Label>
          {logo && <img src={logo} alt="Logo" className="size-16 rounded object-cover" />}
          <Input
            id="l"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => upload("logo_url", e.target.files?.[0])}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="c">Imagem de apresentação</Label>
          {cover && <img src={cover} alt="Capa" className="h-16 rounded object-cover" />}
          <Input
            id="c"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => upload("cover_url", e.target.files?.[0])}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Fuso horário: {b.timezone}</p>
      <Button type="submit" variant="hero" disabled={saving}>
        {saving ? "Salvando..." : "Salvar dados"}
      </Button>
    </form>
  );
}

function HoursForm() {
  const b = useBusiness();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["hours", b.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_hours")
        .select("*")
        .eq("business_id", b.id)
        .order("weekday");
      if (error) throw error;
      return data;
    },
  });
  const [rows, setRows] = useState<BusinessHour[]>([]);
  useEffect(() => {
    if (q.data) setRows(q.data);
  }, [q.data]);
  const upd = (i: number, patch: Partial<BusinessHour>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    for (const r of rows) {
      if (r.is_open && r.close_time <= r.open_time) {
        toast.error(`${WEEKDAYS[r.weekday]}: fechamento deve ser após a abertura.`);
        return;
      }
      if ((r.break_start && !r.break_end) || (!r.break_start && r.break_end)) {
        toast.error(`${WEEKDAYS[r.weekday]}: preencha início e fim do intervalo.`);
        return;
      }
    }
    const { error } = await supabase.from("business_hours").upsert(
      rows.map((r) => ({
        ...r,
        break_start: r.break_start || null,
        break_end: r.break_end || null,
      })),
      { onConflict: "business_id,weekday" },
    );
    if (error) {
      toast.error("Não foi possível salvar os horários.");
      return;
    }
    toast.success("Horários salvos.");
    qc.invalidateQueries({ queryKey: ["hours"] });
    qc.invalidateQueries({ queryKey: ["setup"] });
  }

  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <h2 className="text-2xl font-semibold uppercase">Horários de funcionamento</h2>
      {q.error && (
        <QueryError
          onRetry={() => {
            void q.refetch();
          }}
        />
      )}
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div
            key={r.weekday}
            className="grid grid-cols-2 items-center gap-2 border-b pb-3 sm:grid-cols-[130px_repeat(4,1fr)]"
          >
            <label className="col-span-2 flex items-center gap-2 font-medium sm:col-span-1">
              <Switch checked={r.is_open} onCheckedChange={(v) => upd(i, { is_open: v })} />
              {WEEKDAYS[r.weekday]}
            </label>
            {r.is_open ? (
              <>
                <div>
                  <Label className="text-xs">Abre</Label>
                  <Input
                    type="time"
                    value={r.open_time.slice(0, 5)}
                    onChange={(e) => upd(i, { open_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Fecha</Label>
                  <Input
                    type="time"
                    value={r.close_time.slice(0, 5)}
                    onChange={(e) => upd(i, { close_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Intervalo início</Label>
                  <Input
                    type="time"
                    value={r.break_start?.slice(0, 5) ?? ""}
                    onChange={(e) => upd(i, { break_start: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Intervalo fim</Label>
                  <Input
                    type="time"
                    value={r.break_end?.slice(0, 5) ?? ""}
                    onChange={(e) => upd(i, { break_end: e.target.value || null })}
                  />
                </div>
              </>
            ) : (
              <p className="col-span-2 text-sm text-muted-foreground sm:col-span-4">Fechado</p>
            )}
          </div>
        ))}
      </div>
      <Button variant="hero" onClick={save} disabled={q.isPending || q.isError}>
        Salvar horários
      </Button>
    </section>
  );
}

function Blocks() {
  const b = useBusiness();
  const qc = useQueryClient();
  const [date, setDate] = useState("");
  const [from, setFrom] = useState("08:00");
  const [to, setTo] = useState("18:00");
  const [reason, setReason] = useState("");
  const q = useQuery({
    queryKey: ["blocks", b.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_blocks")
        .select("*")
        .eq("business_id", b.id)
        .gte("ends_at", new Date().toISOString())
        .order("starts_at");
      if (error) throw error;
      return data;
    },
  });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!date || to <= from) {
      toast.error("Informe data e horários válidos.");
      return;
    }
    const { error } = await supabase.from("schedule_blocks").insert({
      business_id: b.id,
      starts_at: zonedToUtc(date, from, b.timezone).toISOString(),
      ends_at: zonedToUtc(date, to, b.timezone).toISOString(),
      reason: reason || null,
    });
    if (error) {
      toast.error("Não foi possível bloquear.");
      return;
    }
    setReason("");
    qc.invalidateQueries({ queryKey: ["blocks"] });
  }
  async function remove(id: string) {
    if (!confirm("Remover este bloqueio?")) return;
    await supabase.from("schedule_blocks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["blocks"] });
  }
  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <h2 className="text-2xl font-semibold uppercase">Bloqueios de agenda</h2>
      <p className="text-sm text-muted-foreground">Feriados, ausências ou manutenções.</p>
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-5">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Data"
          required
        />
        <Input
          type="time"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="Início"
        />
        <Input type="time" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Fim" />
        <Input placeholder="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button type="submit" variant="outline">
          Bloquear
        </Button>
      </form>
      {q.error && (
        <QueryError
          onRetry={() => {
            void q.refetch();
          }}
        />
      )}
      <ul className="space-y-2">
        {q.data?.map((x) => (
          <li key={x.id} className="flex items-center justify-between rounded border p-2 text-sm">
            <span>
              {fmtDateTime(x.starts_at, b.timezone)} –{" "}
              {fmtDateTime(x.ends_at, b.timezone).split(" às ")[1]} {x.reason && `· ${x.reason}`}
            </span>
            <Button size="icon" variant="ghost" onClick={() => remove(x.id)} aria-label="Remover">
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
