"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, ClipboardList, AlertCircle, Loader2, Sparkles } from "lucide-react";
import type { AssetUsageMetricType } from "@/core/assets/types";

export interface CreatePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetId: string;
  onSuccess?: () => void;
}

const METRIC_OPTIONS: { value: AssetUsageMetricType; label: string }[] = [
  { value: "ODOMETER_KM", label: "Kilometraje (km)" },
  { value: "HOURS_OPERATED", label: "Horas de Operación (hrs)" },
  { value: "CYCLES", label: "Ciclos de Uso" },
  { value: "CALENDAR_DAYS", label: "Días Calendario" },
];

export function CreatePlanModal({
  isOpen,
  onClose,
  assetId,
  onSuccess,
}: CreatePlanModalProps) {
  const [name, setName] = useState("");
  const [metricType, setMetricType] = useState<AssetUsageMetricType>("ODOMETER_KM");
  const [intervalValue, setIntervalValue] = useState("");
  const [baselineUsage, setBaselineUsage] = useState("");
  const [baselineDate, setBaselineDate] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const applyOilChangeTemplate = () => {
    setName("Cambio de aceite");
    setMetricType("ODOMETER_KM");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("El nombre del plan es obligatorio.");
      return;
    }

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
      const response = await fetch(`/api/assets/${assetId}/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          metricType,
          intervalValue: numericInterval,
          baselineUsage: numericBaseline,
          baselineDate: baselineDate.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al crear el plan de mantenimiento");
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al crear el plan de mantenimiento");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="create-plan-modal"
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
                Nuevo Plan de Mantenimiento
              </h2>
              <p className="text-xs text-muted-foreground">
                Define un mantenimiento preventivo con su intervalo de desgaste.
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-foreground">
                Nombre del Plan *
              </label>
              <button
                type="button"
                onClick={applyOilChangeTemplate}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <Sparkles className="w-3 h-3" />
                Plantilla «Cambio de aceite»
              </button>
            </div>
            <input
              type="text"
              data-testid="input-plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Cambio de aceite, Revisión de filtros"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Métrica de Desgaste
              </label>
              <select
                data-testid="select-plan-metric"
                value={metricType}
                onChange={(e) => setMetricType(e.target.value as AssetUsageMetricType)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {METRIC_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
                  Creando...
                </>
              ) : (
                "Crear Plan"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
