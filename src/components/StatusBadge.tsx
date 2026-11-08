import { STATUS_LABEL, type AppointmentStatus } from "@/lib/detailhub";
import { cn } from "@/lib/utils";

const STYLES: Record<AppointmentStatus, string> = {
  pendente: "bg-status-pendente/15 text-status-pendente border-status-pendente/40",
  confirmado: "bg-status-confirmado/15 text-status-confirmado border-status-confirmado/40",
  recusado: "bg-status-recusado/15 text-status-recusado border-status-recusado/40",
  cancelado: "bg-status-cancelado/15 text-status-cancelado border-status-cancelado/40",
  concluido: "bg-status-concluido/15 text-status-concluido border-status-concluido/40",
  nao_compareceu:
    "bg-status-nao_compareceu/15 text-status-nao_compareceu border-status-nao_compareceu/40",
};

export function StatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        STYLES[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}
