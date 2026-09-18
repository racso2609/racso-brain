"use client";

import React, { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Layers } from "lucide-react";
import { AssetCard } from "./asset-card";
import type { AssetType, AssetStatus } from "@/core/assets/types";

export interface AssetItemDisplay {
  id: string;
  name: string;
  type: AssetType | string;
  status: AssetStatus | string;
  serialNumber?: string | null;
  createdAt: string | Date;
  customFields?: Record<string, unknown>;
}

export interface AssetListProps {
  items: AssetItemDisplay[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  hasNextPage: boolean;
  isFetchingNextPage?: boolean;
  onFetchNextPage: () => void;
}

export function AssetList({
  items,
  isLoading,
  isError,
  errorMessage = "Ocurrió un error al cargar los activos.",
  onRetry,
  hasNextPage,
  isFetchingNextPage = false,
  onFetchNextPage,
}: AssetListProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage || isFetchingNextPage || isLoading) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onFetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, isLoading, onFetchNextPage]);

  // Loading skeleton
  if (isLoading && items.length === 0) {
    return (
      <div data-testid="assets-loading-skeleton" className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-20 rounded-xl bg-muted/40 animate-pulse border border-border"
          />
        ))}
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="p-8 rounded-xl border border-destructive/20 bg-destructive/5 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
        <p className="text-sm font-medium text-destructive">{errorMessage}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-2 gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Reintentar
          </Button>
        )}
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="p-12 text-center rounded-xl border border-dashed border-border space-y-3 bg-card/50">
        <Layers className="w-10 h-10 text-muted-foreground mx-auto stroke-1" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            No se encontraron activos
          </p>
          <p className="text-xs text-muted-foreground">
            Comienza registrando vehículos, equipos o maquinaria con el botón "Nuevo Activo".
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((asset) => (
          <AssetCard key={asset.id} asset={asset} />
        ))}
      </div>

      {/* Sentinel intersection detector */}
      {hasNextPage && (
        <div ref={sentinelRef} className="py-4 text-center">
          {isFetchingNextPage ? (
            <span className="text-xs text-muted-foreground animate-pulse">
              Cargando más activos...
            </span>
          ) : (
            <div className="h-4" />
          )}
        </div>
      )}
    </div>
  );
}
