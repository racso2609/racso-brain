import React from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { MaintenanceHealthStatus } from "@/core/assets/maintenance-rules";

export interface MaintenanceStatusBadgeProps {
  status: MaintenanceHealthStatus | string;
  size?: "sm" | "md";
}

export function MaintenanceStatusBadge({
  status,
  size = "md",
}: MaintenanceStatusBadgeProps) {
  const isSm = size === "sm";

  switch (status) {
    case "OK":
      return (
        <span
          data-testid="badge-health-ok"
          className={`inline-flex items-center gap-1.5 font-medium rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ${
            isSm ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-xs"
          }`}
        >
          <CheckCircle2 className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
          Saludable / Al Día
        </span>
      );
    case "DUE_SOON":
      return (
        <span
          data-testid="badge-health-due-soon"
          className={`inline-flex items-center gap-1.5 font-medium rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 ${
            isSm ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-xs"
          }`}
        >
          <AlertTriangle className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
          Próximo a Vencer
        </span>
      );
    case "OVERDUE":
      return (
        <span
          data-testid="badge-health-overdue"
          className={`inline-flex items-center gap-1.5 font-medium rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 ${
            isSm ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-xs"
          }`}
        >
          <XCircle className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
          Mantenimiento Vencido
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full border border-muted bg-muted/20 text-muted-foreground ${
            isSm ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-xs"
          }`}
        >
          {status}
        </span>
      );
  }
}
