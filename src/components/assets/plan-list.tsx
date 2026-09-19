"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CreatePlanModal } from "./create-plan-modal";
import { CreateOrderModal } from "./create-order-modal";
import { EditPlanModal } from "./edit-plan-modal";
import {
  ClipboardList,
  Plus,
  CalendarClock,
  AlertCircle,
  RefreshCw,
  Pencil,
  PlusCircle,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";

export interface PlanListProps {
  assetId: string;
  onRefresh?: () => void;
}

interface PlanItem {
  id: string;
  name: string;
  description?: string | null;
  metricType: string;
  intervalValue: string | null;
  intervalDays: number | null;
  baselineUsage: string | null;
  baselineDate?: string | null;
  isActive: boolean;
}

interface ScheduledOrder {
  id: string;
  planId: string | null;
  status: string;
  title: string;
  dueUsage: string | null;
}

const METRIC_LABELS: Record<string, string> = {
  ODOMETER_KM: "Kilometraje",
  HOURS_OPERATED: "Horas de Operación",
  CYCLES: "Ciclos de Uso",
  CALENDAR_DAYS: "Días Calendario",
};

const METRIC_UNITS: Record<string, string> = {
  ODOMETER_KM: "km",
  HOURS_OPERATED: "hrs",
  CYCLES: "ciclos",
  CALENDAR_DAYS: "días",
};

function metricLabel(metricType: string): string {
  return METRIC_LABELS[metricType] ?? metricType;
}

function metricUnit(metricType: string): string {
  return METRIC_UNITS[metricType] ?? "";
}

function formatUsage(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return Number.isInteger(num) ? num.toString() : num.toFixed(2);
}

export function PlanList({ assetId, onRefresh }: PlanListProps) {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [scheduledOrders, setScheduledOrders] = useState<ScheduledOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [creatingOrderPlanId, setCreatingOrderPlanId] = useState<string | null>(
    null,
  );
  const [creatingOrderPlanName, setCreatingOrderPlanName] =
    useState<string>("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [resPlans, resOrders] = await Promise.all([
        fetch(`/api/assets/${assetId}/plans`),
        fetch(`/api/assets/${assetId}/orders?status=SCHEDULED&limit=50`),
      ]);

      const plansJson = resPlans.ok ? await resPlans.json() : { items: [] };
      const ordersJson = resOrders.ok ? await resOrders.json() : { items: [] };

      if (!resPlans.ok && !resOrders.ok) {
        throw new Error("Error al cargar los planes de mantenimiento");
      }

      setPlans(plansJson.items || []);
      setScheduledOrders(ordersJson.items || []);
    } catch (err: any) {
      setError(err.message || "Error al cargar los planes de mantenimiento");
    } finally {
      setIsLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const nextOrderForPlan = (planId: string): ScheduledOrder | undefined => {
    return scheduledOrders
      .filter((o) => o.planId === planId && o.dueUsage != null)
      .sort((a, b) => parseFloat(a.dueUsage!) - parseFloat(b.dueUsage!))[0];
  };

  const handleCreateSuccess = () => {
    fetchData();
    onRefresh?.();
  };

  const handleCreateOrderClick = (planId: string, planName: string) => {
    setCreatingOrderPlanId(planId);
    setCreatingOrderPlanName(planName);
  };

  const handleEditClick = (plan: PlanItem) => {
    setEditingPlan(plan);
    setIsEditOpen(true);
  };

  const handleEditClose = () => {
    setIsEditOpen(false);
    setEditingPlan(null);
  };

  const handleEditSuccess = () => {
    fetchData();
    onRefresh?.();
  };

  const handleToggleActive = async (
    planId: string,
    currentIsActive: boolean,
  ) => {
    try {
      const res = await fetch(`/api/assets/${assetId}/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentIsActive }),
      });
      if (!res.ok) throw new Error("Error al actualizar el plan");
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteClick = async (planId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este plan?")) return;
    try {
      const res = await fetch(`/api/assets/${assetId}/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (!res.ok) throw new Error("Error al eliminar el plan");
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4 animate-pulse">
        <div className="h-5 w-48 bg-muted rounded-lg" />
        <div className="h-20 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div
      data-testid="plan-list"
      className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">
            Planes de Mantenimiento Preventivo
          </h2>
          <span className="text-xs text-muted-foreground">
            {plans.length} plan(es)
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="gap-1.5 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Crear plan
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="ml-auto gap-1.5"
          >
            <RefreshCw className="w-3 h-3" /> Reintentar
          </Button>
        </div>
      )}

      {!error && plans.length === 0 ? (
        <div className="p-4 rounded-xl bg-muted/30 border border-dashed border-border text-center text-xs text-muted-foreground">
          No hay planes de mantenimiento preventivo para este activo.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const nextOrder = nextOrderForPlan(plan.id);
            const unit = metricUnit(plan.metricType);
            return (
              <div
                key={plan.id}
                className="p-4 rounded-xl border border-border bg-muted/30 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <span className="text-sm font-semibold text-foreground block truncate">
                      {plan.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      {metricLabel(plan.metricType)} · cada{" "}
                      {formatUsage(plan.intervalValue)} {unit}
                    </span>
                  </div>
                  {plan.isActive ? (
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                      Activo
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-muted text-muted-foreground border border-border shrink-0">
                      Inactivo
                    </span>
                  )}
                </div>

                <div className="pt-3 border-t border-border flex items-center gap-2 text-xs">
                  <CalendarClock className="w-4 h-4 text-muted-foreground shrink-0" />
                  {nextOrder ? (
                    <span className="text-foreground">
                      Próxima orden:{" "}
                      <span className="font-semibold tabular-nums">
                        {formatUsage(nextOrder.dueUsage)} {unit}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Sin próxima orden programada
                    </span>
                  )}
                </div>

                <div className="pt-3 border-t border-border flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEditClick(plan)}
                    title="Editar"
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreateOrderClick(plan.id, plan.name)}
                    title="Crear orden"
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(plan.id, plan.isActive)}
                    title={plan.isActive ? "Desactivar" : "Activar"}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    {plan.isActive ? (
                      <ToggleRight className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreatePlanModal
        isOpen={isCreateOpen}
        assetId={assetId}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {editingPlan && (
        <EditPlanModal
          key={editingPlan.id}
          isOpen={isEditOpen}
          assetId={assetId}
          plan={editingPlan}
          onClose={handleEditClose}
          onSuccess={handleEditSuccess}
        />
      )}

      <CreateOrderModal
        key={creatingOrderPlanId || "no-plan"}
        isOpen={creatingOrderPlanId !== null}
        assetId={assetId}
        assetName=""
        planId={creatingOrderPlanId || undefined}
        planName={creatingOrderPlanName || undefined}
        onClose={() => {
          setCreatingOrderPlanId(null);
          setCreatingOrderPlanName("");
        }}
        onSuccess={() => {
          setCreatingOrderPlanId(null);
          setCreatingOrderPlanName("");
          fetchData();
          onRefresh?.();
        }}
      />
    </div>
  );
}
