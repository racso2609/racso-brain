import React from "react";
import Link from "next/link";
import { Truck, Fan, Cog, Wrench, Building2, ChevronRight, Hash } from "lucide-react";
import type { AssetType, AssetStatus } from "@/core/assets/types";

export interface AssetCardProps {
  asset: {
    id: string;
    name: string;
    type: AssetType | string;
    status: AssetStatus | string;
    serialNumber?: string | null;
    createdAt: string | Date;
    customFields?: Record<string, unknown>;
  };
}

function getAssetIcon(type: string) {
  switch (type) {
    case "VEHICLE":
      return <Truck className="w-5 h-5 text-blue-500" />;
    case "HVAC":
      return <Fan className="w-5 h-5 text-cyan-500" />;
    case "HEAVY_MACHINERY":
      return <Cog className="w-5 h-5 text-amber-500" />;
    case "EQUIPMENT":
      return <Wrench className="w-5 h-5 text-purple-500" />;
    case "FACILITY":
      return <Building2 className="w-5 h-5 text-emerald-500" />;
    default:
      return <Cog className="w-5 h-5 text-muted-foreground" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "OPERATIONAL":
      return (
        <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          Operativo
        </span>
      );
    case "UNDER_MAINTENANCE":
      return (
        <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          En Mantenimiento
        </span>
      );
    case "DECOMMISSIONED":
      return (
        <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-muted text-muted-foreground border border-border">
          Dado de Baja
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-muted text-muted-foreground">
          {status}
        </span>
      );
  }
}

export function AssetCard({ asset }: AssetCardProps) {
  return (
    <Link
      href={`/assets/${asset.id}`}
      className="group block p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-muted/50 border border-border group-hover:bg-primary/5 transition-colors">
            {getAssetIcon(asset.type)}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {asset.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="font-medium tracking-wide">{asset.type}</span>
              {asset.serialNumber && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-0.5 font-mono">
                    <Hash className="w-3 h-3 opacity-60" />
                    {asset.serialNumber}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge(asset.status)}
          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}
