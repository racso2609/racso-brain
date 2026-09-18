"use client";

import React, { useState } from "react";
import { ChevronDown, Check, Building2 } from "lucide-react";
import { ACTIVE_TENANT_COOKIE } from "@/core/tenancy/context";

export interface TenantOption {
  id: string;
  name: string;
  role?: string;
}

export interface TenantSwitcherProps {
  activeTenantId: string;
  tenants: TenantOption[];
  onSwitchTenant?: (tenantId: string) => void;
}

export function TenantSwitcher({
  activeTenantId,
  tenants,
  onSwitchTenant,
}: TenantSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeTenant = tenants.find((t) => t.id === activeTenantId) ?? tenants[0];

  const handleSelect = (tenantId: string) => {
    setIsOpen(false);

    if (onSwitchTenant) {
      onSwitchTenant(tenantId);
      return;
    }

    // Set cookie on client side and reload / refresh
    document.cookie = `${ACTIVE_TENANT_COOKIE}=${tenantId}; path=/; max-age=2592000; SameSite=Lax`;
    window.location.reload();
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-accent/50 transition-colors text-sm font-medium shadow-sm min-w-[200px]"
      >
        <div className="flex items-center gap-2 truncate">
          <Building2 className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">{activeTenant?.name ?? "Seleccionar espacio"}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 mt-1.5 w-64 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg z-50 py-1.5 focus:outline-none"
        >
          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border mb-1">
            Espacios de Trabajo
          </div>
          {tenants.map((tenant) => {
            const isSelected = tenant.id === activeTenant?.id;
            return (
              <button
                key={tenant.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(tenant.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors ${
                  isSelected ? "font-semibold bg-accent/40" : ""
                }`}
              >
                <div className="flex flex-col">
                  <span>{tenant.name}</span>
                  {tenant.role && (
                    <span className="text-xs text-muted-foreground">
                      Rol: {tenant.role}
                    </span>
                  )}
                </div>
                {isSelected && <Check className="w-4 h-4 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
