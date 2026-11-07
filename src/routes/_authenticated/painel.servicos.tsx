import { pageHead } from "@/lib/page-head";
import { QueryError } from "@/components/QueryError";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadMedia, useBusiness, useMediaUrl, type Service } from "@/lib/business";
import { formatBRL, parseBRLToCents } from "@/lib/detailhub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/painel/servicos")({ head: () => pageHead("Serviços", "Gerencie os serviços da sua estética."), component: Services });

function Services() {
  const b = useBusiness();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const q = useQuery({
    queryKey: ["services", b.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").eq("business_id", b.id).order("is_active", { ascending: false }).order("name");
      if (error) throw error;
      return data;
    },
  });
  const toggle = useMutation({
    mutationFn: async (s: Service) => {
      const { error } = await supabase.from("services").update({ is_active: !s.is_active }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["services"] }); qc.invalidateQueries({ queryKey: ["setup"] }); },
    onError: () => toast.error("Não foi possível alterar."),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold uppercase">Serviços</h1>
        <Button variant="hero" onClick={() => setEditing("new")}><Plus /> Novo serviço</Button>
      </div>
      {q.error ? <QueryError onRetry={() => { void q.refetch(); }} /> : q.isLoading ? <p className="text-muted-foreground">Carregando...</p> : !q.data?.length ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">Nenhum serviço ainda. Ex.: lavagem técnica, higienização interna, polimento, vitrificação.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {q.data.map((s) => (
            <div key={s.id} className={`rounded-lg border bg-card p-4 ${s.is_active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-xl font-semibold">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{formatBRL(s.price_cents)} · {s.duration_minutes} min</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setEditing(s)} aria-label={`Editar ${s.name}`}><Pencil /></Button>
              </div>
              {s.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>}
              <label className="mt-3 flex items-center gap-2 text-sm">
                <Switch checked={s.is_active} onCheckedChange={() => toggle.mutate(s)} /> {s.is_active ? "Ativo" : "Inativo"}
              </label>
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing === "new" ? "Novo serviço" : "Editar serviço"}</DialogTitle></DialogHeader>
          {editing && <ServiceForm key={editing === "new" ? "new" : editing.id} service={editing === "new" ? null : editing} businessId={b.id} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceForm({ service, businessId, onDone }: { service: Service | null; businessId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [price, setPrice] = useState(service ? (service.price_cents / 100).toFixed(2).replace(".", ",") : "");
  const [duration, setDuration] = useState(String(service?.duration_minutes ?? 60));
  const [image, setImage] = useState<string | null>(service?.image_url ?? null);
  const [saving, setSaving] = useState(false);
  const preview = useMediaUrl(image);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseBRLToCents(price);
    const dur = Number(duration);
    if (name.trim().length < 2) { toast.error("Informe o nome do serviço."); return; }
    if (cents === null) { toast.error("Preço inválido. Ex.: 80,00"); return; }
    if (!Number.isInteger(dur) || dur < 15 || dur > 720) { toast.error("Duração entre 15 e 720 minutos."); return; }
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || null, price_cents: cents, duration_minutes: dur, image_url: image };
    const { error } = service
      ? await supabase.from("services").update(payload).eq("id", service.id)
      : await supabase.from("services").insert({ ...payload, business_id: businessId });
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar."); return; }
    toast.success("Serviço salvo.");
    qc.invalidateQueries({ queryKey: ["services"] });
    qc.invalidateQueries({ queryKey: ["setup"] });
    onDone();
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="space-y-1"><Label htmlFor="sn">Nome</Label><Input id="sn" value={name} onChange={(e) => setName(e.target.value)} required /></div>
      <div className="space-y-1"><Label htmlFor="sd">Descrição</Label><Textarea id="sd" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label htmlFor="sp">Preço (R$)</Label><Input id="sp" inputMode="decimal" placeholder="80,00" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
        <div className="space-y-1"><Label htmlFor="sdu">Duração (min)</Label><Input id="sdu" type="number" min={15} max={720} step={15} value={duration} onChange={(e) => setDuration(e.target.value)} required /></div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="si">Imagem (opcional)</Label>
        {preview && <img src={preview} alt="" className="h-24 rounded object-cover" />}
        <Input id="si" type="file" accept="image/jpeg,image/png,image/webp" onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          try { setImage(await uploadMedia(businessId, f, "service")); } catch (err) { toast.error((err as Error).message); }
        }} />
      </div>
      {service && <p className="text-xs text-muted-foreground">Alterações de preço e duração não mudam agendamentos já registrados.</p>}
      <Button type="submit" variant="hero" className="w-full" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
    </form>
  );
}
