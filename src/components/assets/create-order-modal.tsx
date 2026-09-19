"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { InfoPopover } from "@/components/ui/info-popover";
import { X, Wrench, AlertCircle, Loader2, DollarSign } from "lucide-react";
import type { MaintenanceOrderType, MaintenancePaymentTerms } from "@/core/assets/types";

export interface CreateOrderModalProps {
  isOpen: boolean;
  assetId: string;
  assetName: string;
  planId?: string;
  planName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateOrderModal({
  isOpen,
  assetId,
  assetName,
  planId,
  planName,
  onClose,
  onSuccess,
}: CreateOrderModalProps) {
  const [orderType, setOrderType] = useState<MaintenanceOrderType>("PREVENTIVE");
  const [title, setTitle] = useState(planName || "");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("0.00");
  const [currency, setCurrency] = useState("USD");
  const [paymentTerms, setPaymentTerms] = useState<MaintenancePaymentTerms>("IMMEDIATE");
  const [providerName, setProviderName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [usageAtService, setUsageAtService] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("El título de la orden es obligatorio.");
      return;
    }

    const numericCost = parseFloat(cost);
    if (isNaN(numericCost) || numericCost < 0) {
      setError("El costo debe ser un monto válido mayor o igual a 0.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/assets/${assetId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType,
          title: title.trim(),
          description: description.trim() || null,
          cost: numericCost.toFixed(2),
          currency,
          paymentTerms,
          providerName: providerName.trim() || null,
          invoiceNumber: invoiceNumber.trim() || null,
          serviceDate,
          usageAtService: usageAtService ? parseFloat(usageAtService) : null,
          planId: planId || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al crear la orden de mantenimiento");
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al crear la orden de mantenimiento");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="create-order-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Nueva Orden de Mantenimiento
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
            data-testid="order-error-message"
            className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Tipo de Intervención
              </label>
              <select
                data-testid="select-order-type"
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as MaintenanceOrderType)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
              >
                <option value="PREVENTIVE">Mantenimiento Preventivo</option>
                <option value="CORRECTIVE">Reparación Correctiva</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Fecha del Servicio
              </label>
              <input
                type="date"
                data-testid="input-service-date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Título de la Orden *
            </label>
            <input
              type="text"
              data-testid="input-order-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Cambio de Aceite y Filtros 50,000 km"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Descripción del Trabajo
            </label>
            <textarea
              data-testid="input-order-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Detalles de la labor ejecutada o programada"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
            />
          </div>

          {/* Financial & Cost Integration */}
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              Integración Contable (Financial Ledger)
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Costo Total
                </label>
                <input
                  type="number"
                  step="0.01"
                  data-testid="input-order-cost"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background font-mono"
                  required
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1">
                  Términos de Pago
                  <InfoPopover content="Define cuándo se registra el gasto contable. 'Inmediato' genera un gasto directo. 'Crédito X días' genera una cuenta por pagar con vencimiento futuro." />
                </label>
                <select
                  data-testid="select-payment-terms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value as MaintenancePaymentTerms)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                >
                  <option value="IMMEDIATE">Inmediato (Gasto)</option>
                  <option value="CREDIT_15_DAYS">Crédito 15 Días (Por Pagar)</option>
                  <option value="CREDIT_30_DAYS">Crédito 30 Días (Por Pagar)</option>
                  <option value="CREDIT_60_DAYS">Crédito 60 Días (Por Pagar)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Taller / Proveedor
                </label>
                <input
                  type="text"
                  data-testid="input-provider-name"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  placeholder="Ej. Taller Mecánico Central"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  N° Factura / Comprobante
                </label>
                <input
                  type="text"
                  data-testid="input-invoice-number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Ej. FAC-2026-901"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1">
              Lectura de Desgaste al Servicio (km / hrs)
              <InfoPopover content="Registra el kilometraje u horas de uso del activo al momento del servicio. Este valor se usa para calcular el desgaste acumulado y programar el próximo mantenimiento." />
            </label>
            <input
              type="number"
              step="any"
              data-testid="input-usage-at-service"
              value={usageAtService}
              onChange={(e) => setUsageAtService(e.target.value)}
              placeholder="Ej. 52500"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
            />
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
              data-testid="button-submit-order"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear Orden"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
