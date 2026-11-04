import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Car, Clock, MessageCircle, Phone } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "./StatusBadge";
import {
  buildWhatsAppConfirmation,
  fmtDate,
  fmtTime,
  formatBRL,
  formatPhone,
  STATUS_TRANSITIONS,
  whatsAppLink,
  type AppointmentStatus,
} from "@/lib/detailhub";
import type { Business } from "@/lib/business";
import { cn } from "@/lib/utils";

export const APPOINTMENT_SELECT = "*, customers(id, name, phone), vehicles(model, plate)";

export type AppointmentRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  service_name: string;
  price_cents: number;
  duration_minutes: number;
  notes: string | null;
  customers: { id: string; name: string; phone: string } | null;
  vehicles: { model: string; plate: string | null } | null;
};

const ACTION: Record<AppointmentStatus, { label: string; variant: "success" | "destructive" | "outline" | "default"; confirm?: string }> = {
  confirmado: { label: "Aprovar", variant: "success" },
  recusado: { label: "Recusar", variant: "destructive", confirm: "Recusar esta solicitação? O horário será liberado." },
  cancelado: { label: "Cancelar", variant: "outline", confirm: "Cancelar este agendamento? O horário será liberado." },
  concluido: { label: "Concluir", variant: "default" },
  nao_compareceu: { label: "Não compareceu", variant: "outline", confirm: "Marcar que o cliente não compareceu?" },
  pendente: { label: "", variant: "outline" },
};

export function AppointmentCard({ a, business, showDate = true }: { a: AppointmentRow; business: Business; showDate?: boolean }) {
  const qc = useQueryClient();
  const tz = business.timezone;
  const m = useMutation({
    mutationFn: async (next: AppointmentStatus) => {
      const { error } = await supabase.rpc("change_appointment_status", { _appointment_id: a.id, _new_status: next });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado.");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["customer"] });
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível atualizar."),
  });

  const actions = STATUS_TRANSITIONS[a.status];
  const waMsg =
    a.customers &&
    buildWhatsAppConfirmation({
      customerName: a.customers.name,
      businessName: business.name,
      serviceName: a.service_name,
      startsAt: a.starts_at,
      priceCents: a.price_cents,
      address: business.address,
      timezone: tz,
    });

  return (
    <div className={cn("rounded-lg border bg-card p-4", a.status === "pendente" && "border-status-pendente/60 ring-1 ring-status-pendente/30")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 font-display text-xl font-semibold">
            <Clock className="size-4 text-primary" />
            {showDate && <span>{fmtDate(a.starts_at, tz, { weekday: "short" })} ·</span>}
            {fmtTime(a.starts_at, tz)}–{fmtTime(a.ends_at, tz)}
          </div>
          <p className="font-semibold">{a.service_name} <span className="font-normal text-muted-foreground">· {formatBRL(a.price_cents)}</span></p>
        </div>
        <StatusBadge status={a.status} />
      </div>
      {a.customers && (
        <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
          <Link to="/painel/clientes/$id" params={{ id: a.customers.id }} className="font-medium text-foreground hover:text-primary">{a.customers.name}</Link>
          <span className="flex items-center gap-1.5"><Phone className="size-3.5" />{formatPhone(a.customers.phone)}</span>
          {a.vehicles && <span className="flex items-center gap-1.5"><Car className="size-3.5" />{a.vehicles.model}{a.vehicles.plate ? ` · ${a.vehicles.plate}` : ""}</span>}
          {a.notes && <span className="italic">“{a.notes}”</span>}
        </div>
      )}
      {(actions.length > 0 || a.status === "confirmado") && (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((s) => {
            const cfg = ACTION[s];
            const btn = (
              <Button key={s} size="sm" variant={cfg.variant} disabled={m.isPending} onClick={cfg.confirm ? undefined : () => m.mutate(s)}>
                {cfg.label}
              </Button>
            );
            if (!cfg.confirm) return btn;
            return (
              <AlertDialog key={s}>
                <AlertDialogTrigger asChild>{btn}</AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{cfg.label}</AlertDialogTitle>
                    <AlertDialogDescription>{cfg.confirm}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => m.mutate(s)}>Confirmar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            );
          })}
          {a.status === "confirmado" && a.customers && waMsg && (
            <Button asChild size="sm" variant="whatsapp">
              <a href={whatsAppLink(a.customers.phone, waMsg)} target="_blank" rel="noreferrer">
                <MessageCircle /> Enviar confirmação pelo WhatsApp
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
