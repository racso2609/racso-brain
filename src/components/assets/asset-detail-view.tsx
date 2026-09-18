"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MaintenanceStatusBadge } from "./maintenance-status-badge";
import { RegisterUsageModal } from "./register-usage-modal";
import { CreateOrderModal } from "./create-order-modal";
import { CreatePlanModal } from "./create-plan-modal";
import { PlanList } from "./plan-list";
import {
  ArrowLeft,
  Truck,
  Fan,
  Cog,
  Wrench,
  Building2,
  Gauge,
  ClipboardList,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  Plus,
  RefreshCw,
} from "lucide-react";
import type { AssetOverallHealthResult } from "@/core/assets/maintenance-rules";
import type { AssetUsageMetricType } from "@/core/assets/types";

export interface AssetDetailData {
  asset: {
    id: string;
    name: string;
    type: string;
    status: string;
    serialNumber?: string | null;
    customFields: Record<string, any>;
    createdAt: string;
  };
  health: AssetOverallHealthResult;
  latestUsageLog?: {
    metricType: AssetUsageMetricType;
    value: string;
    recordedAt: string;
  } | null;
}

export function AssetDetailView({ assetId }: { assetId: string }) {
  const [data, setData] = useState<AssetDetailData | null>(null);
  const [usageLogs, setUsageLogs] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isCreatePlanModalOpen, setIsCreatePlanModalOpen] = useState(false);
  const [planListKey, setPlanListKey] = useState(0);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [resDetail, resLogs, resOrders] = await Promise.all([
        fetch(`/api/assets/${assetId}`),
        fetch(`/api/assets/${assetId}/usage-logs?limit=5`),
        fetch(`/api/assets/${assetId}/orders?limit=10`),
      ]);

      if (!resDetail.ok) {
        throw new Error("Error al cargar la información del activo");
      }

      const detailJson = await resDetail.json();
      const logsJson = resLogs.ok ? await resLogs.json() : { items: [] };
      const ordersJson = resOrders.ok ? await resOrders.json() : { items: [] };

      setData(detailJson);
      setUsageLogs(logsJson.items || []);
      setOrders(ordersJson.items || []);
    } catch (err: any) {
      setError(err.message || "Error al cargar el activo");
    } finally {
      setIsLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCompleteOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/assets/${assetId}/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "COMPLETE" }),
      });
      if (!res.ok) throw new Error("Error al completar la orden");
      fetchData();
      setPlanListKey((k) => k + 1);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const reason = prompt("Ingrese el motivo de la cancelación:");
    if (!reason || !reason.trim()) return;

    try {
      const res = await fetch(`/api/assets/${assetId}/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL", reason: reason.trim() }),
      });
      if (!res.ok) throw new Error("Error al cancelar la orden");
      fetchData();
      setPlanListKey((k) => k + 1);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-muted rounded-lg" />
        <div className="h-28 bg-muted rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-48 bg-muted rounded-2xl" />
          <div className="h-48 bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center rounded-2xl border border-destructive/20 bg-destructive/5 space-y-3">
        <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
        <p className="text-sm font-medium text-destructive">{error || "Activo no encontrado"}</p>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </Button>
      </div>
    );
  }

  const { asset, health, latestUsageLog } = data;

  const renderTypeIcon = (type: string) => {
    switch (type) {
      case "VEHICLE":
        return <Truck className="w-6 h-6 text-blue-500" />;
      case "HVAC":
        return <Fan className="w-6 h-6 text-cyan-500" />;
      case "HEAVY_MACHINERY":
        return <Cog className="w-6 h-6 text-amber-500" />;
      case "EQUIPMENT":
        return <Wrench className="w-6 h-6 text-purple-500" />;
      case "FACILITY":
        return <Building2 className="w-6 h-6 text-emerald-500" />;
      default:
        return <Cog className="w-6 h-6 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="space-y-3">
        <Link
          href="/assets"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver al Catálogo
        </Link>

        <div className="p-6 rounded-2xl border border-border bg-card shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-muted/60 border border-border">
              {renderTypeIcon(asset.type)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-foreground">{asset.name}</h1>
                <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground border border-border">
                  {asset.status}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span className="font-semibold uppercase tracking-wider">{asset.type}</span>
                {asset.serialNumber && (
                  <>
                    <span>•</span>
                    <span className="font-mono">SN: {asset.serialNumber}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsUsageModalOpen(true)}
              className="gap-2 text-xs"
            >
              <Gauge className="w-3.5 h-3.5 text-blue-500" />
              Registrar Telemetría
            </Button>
            <Button
              size="sm"
              onClick={() => setIsOrderModalOpen(true)}
              className="gap-2 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva Orden
            </Button>
          </div>
        </div>
      </div>

      {/* Grid: Health Status & Polymorphic Specs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Health Traffic Light Card */}
        <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">
                Semáforo de Mantenimiento Preventivo
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <MaintenanceStatusBadge status={health.overallStatus} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCreatePlanModalOpen(true)}
                className="gap-1.5 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Crear plan
              </Button>
            </div>
          </div>

          {health.planResults.length === 0 ? (
            <div className="p-4 rounded-xl bg-muted/30 border border-dashed border-border text-center text-xs text-muted-foreground">
              No hay planes de mantenimiento preventivo activos para este activo.
            </div>
          ) : (
            <div className="space-y-3">
              {health.planResults.map((plan) => (
                <div key={plan.planId} className="p-3 rounded-xl bg-muted/30 border border-border space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{plan.planName}</span>
                    <MaintenanceStatusBadge status={plan.status} size="sm" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Desgaste acumulado</span>
                      <span className="font-semibold tabular-nums">{plan.maxPercentage}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          plan.status === "OVERDUE"
                            ? "bg-rose-500"
                            : plan.status === "DUE_SOON"
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(plan.maxPercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Technical Specifications (Custom Fields) */}
        <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-foreground">
            Ficha Técnica / Especificaciones
          </h2>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {Object.entries(asset.customFields || {}).map(([key, val]) => (
              <div key={key} className="p-3 rounded-xl bg-muted/30 border border-border">
                <span className="text-muted-foreground block capitalize text-[11px]">
                  {key.replace(/([A-Z])/g, " $1")}
                </span>
                <span className="font-semibold text-foreground mt-0.5 block truncate">
                  {String(val)}
                </span>
              </div>
            ))}
            {latestUsageLog && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-muted-foreground block">
                    Última Lectura de Telemetría ({latestUsageLog.metricType})
                  </span>
                  <span className="font-bold text-foreground text-sm font-mono mt-0.5">
                    {latestUsageLog.value}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(latestUsageLog.recordedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Maintenance Plans */}
      <PlanList key={planListKey} assetId={asset.id} onRefresh={fetchData} />

      {/* Maintenance Orders History */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              Historial de Órdenes de Mantenimiento
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">{orders.length} órdenes registradas</span>
        </div>

        {orders.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No se han registrado intervenciones ni órdenes de trabajo.
          </p>
        ) : (
          <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
            {orders.map((ord) => (
              <div key={ord.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{ord.title}</span>
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-muted border border-border">
                      {ord.orderType}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary">
                      {ord.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Fecha: {ord.serviceDate}</span>
                    {ord.providerName && <span>• Taller: {ord.providerName}</span>}
                    {ord.financialTransactionId && (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <DollarSign className="w-3 h-3" /> Asiento Ledger
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-foreground font-mono">
                    ${ord.cost} {ord.currency}
                  </span>
                  {(ord.status === "SCHEDULED" || ord.status === "IN_PROGRESS") && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2 text-emerald-600 hover:bg-emerald-500/10"
                        onClick={() => handleCompleteOrder(ord.id)}
                      >
                        Completar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2 text-destructive hover:bg-destructive/10"
                        onClick={() => handleCancelOrder(ord.id)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <RegisterUsageModal
        isOpen={isUsageModalOpen}
        assetId={asset.id}
        assetName={asset.name}
        onClose={() => setIsUsageModalOpen(false)}
        onSuccess={fetchData}
      />

      <CreateOrderModal
        isOpen={isOrderModalOpen}
        assetId={asset.id}
        assetName={asset.name}
        onClose={() => setIsOrderModalOpen(false)}
        onSuccess={fetchData}
      />

      <CreatePlanModal
        isOpen={isCreatePlanModalOpen}
        assetId={asset.id}
        onClose={() => setIsCreatePlanModalOpen(false)}
        onSuccess={() => {
          setPlanListKey((k) => k + 1);
          fetchData();
        }}
      />
    </div>
  );
}
