"use client";

import React from "react";
import { Search, Filter } from "lucide-react";
import type { AssetType, AssetStatus } from "@/core/assets/types";

export interface AssetFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  selectedType: AssetType | "ALL";
  onTypeChange: (type: AssetType | "ALL") => void;
  selectedStatus: AssetStatus | "ALL";
  onStatusChange: (status: AssetStatus | "ALL") => void;
}

const ASSET_TYPES: Array<{ label: string; value: AssetType | "ALL" }> = [
  { label: "Todos los Tipos", value: "ALL" },
  { label: "Vehículos", value: "VEHICLE" },
  { label: "HVAC / Clima", value: "HVAC" },
  { label: "Maquinaria Pesada", value: "HEAVY_MACHINERY" },
  { label: "Equipos", value: "EQUIPMENT" },
  { label: "Instalaciones", value: "FACILITY" },
];

export function AssetFilters({
  search,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedStatus,
  onStatusChange,
}: AssetFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            data-testid="input-asset-search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre, placa o serie..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0 hidden sm:block" />
          <select
            data-testid="filter-status-select"
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value as AssetStatus | "ALL")}
            className="w-full sm:w-auto px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="OPERATIONAL">Operativo</option>
            <option value="UNDER_MAINTENANCE">En Mantenimiento</option>
            <option value="DECOMMISSIONED">Dado de Baja</option>
          </select>
        </div>
      </div>

      {/* Type Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {ASSET_TYPES.map((t) => {
          const isSelected = selectedType === t.value;
          return (
            <button
              key={t.value}
              type="button"
              data-testid={`filter-type-${t.value.toLowerCase()}`}
              onClick={() => onTypeChange(t.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
