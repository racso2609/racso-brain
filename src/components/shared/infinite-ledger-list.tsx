"use client";

import React, { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowDownRight, ArrowUpRight, Receipt, RefreshCw } from "lucide-react";

export interface LedgerItemDisplay {
  id: string;
  description: string;
  amount: string;
  currency: string;
  txType: string;
  status: string;
  category: string;
  createdAt: string | Date;
}

export interface InfiniteLedgerListProps {
  items: LedgerItemDisplay[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  hasNextPage: boolean;
  isFetchingNextPage?: boolean;
  onFetchNextPage: () => void;
}

export function InfiniteLedgerList({
  items,
  isLoading,
  isError,
  errorMessage = "Ocurrió un error al cargar las transacciones.",
  onRetry,
  hasNextPage,
  isFetchingNextPage = false,
  onFetchNextPage,
}: InfiniteLedgerListProps) {
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
      <div data-testid="ledger-loading-skeleton" className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-16 rounded-lg bg-muted/40 animate-pulse border border-border"
          />
        ))}
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="p-6 rounded-xl border border-destructive/20 bg-destructive/5 text-center space-y-3">
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
        <Receipt className="w-10 h-10 text-muted-foreground mx-auto stroke-1" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            No hay transacciones registradas
          </p>
          <p className="text-xs text-muted-foreground">
            Los movimientos contables y operativos aparecerán aquí automáticamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="divide-y divide-border border border-border rounded-xl bg-card shadow-sm overflow-hidden">
        {items.map((item) => {
          const isIncome = item.txType === "INCOME" || item.txType === "RECEIVABLE";
          return (
            <div
              key={item.id}
              className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`p-2 rounded-lg ${
                    isIncome
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {isIncome ? (
                    <ArrowDownRight className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {item.description}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="font-medium uppercase tracking-wider">{item.category}</span>
                    <span>•</span>
                    <span className="capitalize">{item.status.toLowerCase().replace("_", " ")}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div
                  className={`text-sm font-semibold tabular-nums ${
                    isIncome
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-foreground"
                  }`}
                >
                  {isIncome ? "+" : "-"}${item.amount} {item.currency}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(item.createdAt).toLocaleDateString("es-ES", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sentinel intersection detector */}
      {hasNextPage && (
        <div ref={sentinelRef} className="py-4 text-center">
          {isFetchingNextPage ? (
            <span className="text-xs text-muted-foreground animate-pulse">
              Cargando más transacciones...
            </span>
          ) : (
            <div className="h-4" />
          )}
        </div>
      )}
    </div>
  );
}
