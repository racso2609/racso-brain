"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Gauge, AlertCircle, Loader2 } from "lucide-react";
import type { AssetUsageMetricType } from "@/core/assets/types";

export interface RegisterUsageModalProps {
  isOpen: boolean;
  assetId: string;
  assetName: string;
  defaultMetricType?: AssetUsageMetricType;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RegisterUsageModal({
  isOpen,
  assetId,
  assetName,
  defaultMetricType = "ODOMETER_KM",
  onClose,
  onSuccess,
}: RegisterUsageModalProps) {
  const [metricType, setMetricType] = useState<AssetUsageMetricType>(defaultMetricType);
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [allowMeterReplacement, setAllowMeterReplacement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numericVal = parseFloat(value);
    if (isNaN(numericVal) || numericVal < 0) {
      setError("El valor ingresado debe ser un número positivo.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/assets/${assetId}/usage-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricType,
          value: numericVal,
          notes: notes.trim() || null,
          allowMeterReplacement,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al registrar la lectura");
      }

      setValue("");
      setNotes("");
      setAllowMeterReplacement(false);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al registrar la lectura");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="register-usage-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Registrar Telemetría
              </h2>
              <p className="text-xs text-muted-foreground truncate max-w-[240px]">
                {assetName}
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
            data-testid="usage-error-message"
            className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Métrica de Desgaste
            </label>
            <select
              data-testid="select-metric-type"
              value={metricType}
              onChange={(e) => setMetricType(e.target.value as AssetUsageMetricType)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="ODOMETER_KM">Kilometraje (km)</option>
              <option value="HOURS_OPERATED">Horas de Operación (hrs)</option>
              <option value="CYCLES">Ciclos de Uso</option>
              <option value="CALENDAR_DAYS">Días Calendario</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Lectura Acumulada Total *
            </label>
            <input
              type="number"
              step="any"
              data-testid="input-metric-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ej. 52450.5"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Notas / Observaciones
            </label>
            <textarea
              data-testid="input-metric-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ej. Lectura tomada al finalizar ruta"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 border border-border text-xs">
            <input
              type="checkbox"
              id="allowMeterReplacement"
              data-testid="checkbox-replacement"
              checked={allowMeterReplacement}
              onChange={(e) => setAllowMeterReplacement(e.target.checked)}
              className="mt-0.5 rounded border-border text-primary focus:ring-primary/20"
            />
            <label
              htmlFor="allowMeterReplacement"
              className="text-muted-foreground leading-relaxed cursor-pointer"
            >
              <span className="font-semibold text-foreground">
                Sustitución de medidor / odómetro
              </span>
              <br />
              Permite registrar un valor inferior al previo por reemplazo del reloj indicador.
            </label>
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
              data-testid="button-submit-usage"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                "Guardar Lectura"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
