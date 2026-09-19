"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, ClipboardList, AlertCircle, Loader2, Lock } from "lucide-react";

export interface EditPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetId: string;
  plan: {
    id: string;
    name: string;
    description?: string | null;
    metricType: string;
    intervalValue: string | null;
    baselineUsage?: string | null;
    baselineDate?: string | null;
  };
  onSuccess: () => void;
}

const METRIC_LABELS: Record<string, string> = {
  ODOMETER_KM: "Kilometraje",
  HOURS_OPERATED: "Horas de Operación",
  CYCLES: "Ciclos de Uso",
  CALENDAR_DAYS: "Días Calendario",
};

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function EditPlanModal({
  isOpen,
  onClose,
  assetId,
  plan,
  onSuccess,
}: EditPlanModalProps) {
  const [intervalValue, setIntervalValue] = useState(
    plan.intervalValue != null ? String(plan.intervalValue) : ""
  );
  const [baselineUsage, setBaselineUsage] = useState(
    plan.baselineUsage != null ? String(plan.baselineUsage) : ""
  );
  const [baselineDate, setBaselineDate] = useState(
    toDateInputValue(plan.baselineDate)
  );

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numericInterval = parseFloat(intervalValue);
    if (isNaN(numericInterval) || numericInterval <= 0) {
      setError("El intervalo debe ser un número mayor a 0.");
      return;
    }

    const numericBaseline =
      baselineUsage.trim() === "" ? null : parseFloat(baselineUsage);
    if (numericBaseline !== null && (isNaN(numericBaseline) || numericBaseline < 0)) {
      setError("El uso base debe ser un número mayor o igual a 0.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/assets/${assetId}/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intervalValue: numericInterval,
          baselineUsage: numericBaseline,
          baselineDate: baselineDate.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al actualizar el plan de mantenimiento");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al actualizar el plan de mantenimiento");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="edit-plan-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Editar Plan de Mantenimiento
              </h2>
              <p className="text-xs text-muted-foreground">
                Actualiza el intervalo y los valores base del plan.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            data-testid="plan-error-message"
            className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Nombre del Plan
            </label>
            <div className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted/40 text-muted-foreground">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{plan.name}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              El nombre y la métrica no se pueden modificar.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Métrica de Desgaste
              </label>
              <div className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted/40 text-muted-foreground">
                {METRIC_LABELS[plan.metricType] ?? plan.metricType}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Intervalo *
              </label>
              <input
                type="number"
                step="any"
                min="0"
                data-testid="input-plan-interval"
                value={intervalValue}
                onChange={(e) => setIntervalValue(e.target.value)}
                placeholder="Ej. 10000"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Uso Base (opcional)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                data-testid="input-plan-baseline-usage"
                value={baselineUsage}
                onChange={(e) => setBaselineUsage(e.target.value)}
                placeholder="Ej. 50000"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Fecha Base (opcional)
              </label>
              <input
                type="date"
                data-testid="input-plan-baseline-date"
                value={baselineDate}
                onChange={(e) => setBaselineDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              data-testid="button-submit-plan"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
