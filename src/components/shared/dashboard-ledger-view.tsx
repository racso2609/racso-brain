"use client";

import React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { InfiniteLedgerList, type LedgerItemDisplay } from "./infinite-ledger-list";
import { PermissionGate } from "./permission-gate";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import type { PaginatedResult } from "@/lib/pagination/types";
import type { FinancialTransaction } from "@/db/schema/ledger";

interface DashboardLedgerViewProps {
  userRole?: string;
}

async function fetchLedgerPage({ pageParam }: { pageParam?: string }) {
  const url = new URL("/api/ledger", window.location.origin);
  url.searchParams.set("limit", "10");
  if (pageParam) {
    url.searchParams.set("cursor", pageParam);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error("Error al obtener los movimientos del Ledger");
  }
  return (await res.json()) as PaginatedResult<FinancialTransaction>;
}

export function DashboardLedgerView({ userRole }: DashboardLedgerViewProps) {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["dashboard-ledger"],
    queryFn: fetchLedgerPage,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
  });

  const allItems: LedgerItemDisplay[] =
    data?.pages.flatMap((page) =>
      page.items.map((item) => ({
        id: item.id,
        description: item.description,
        amount: item.amount,
        currency: item.currency,
        txType: item.txType,
        status: item.status,
        category: item.category,
        createdAt: item.createdAt,
      }))
    ) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Libro Diario (Financial Ledger)
          </h2>
          <p className="text-sm text-muted-foreground">
            Flujo transaccional consolidado en tiempo real con paginación cursor-based.
          </p>
        </div>

        <PermissionGate userRole={userRole} requiredPermission="ledger:write">
          <Button size="sm" className="gap-2">
            <PlusCircle className="w-4 h-4" />
            Registrar Movimiento
          </Button>
        </PermissionGate>
      </div>

      <InfiniteLedgerList
        items={allItems}
        isLoading={isLoading}
        isError={isError}
        errorMessage={error?.message}
        onRetry={() => refetch()}
        hasNextPage={Boolean(hasNextPage)}
        isFetchingNextPage={isFetchingNextPage}
        onFetchNextPage={() => fetchNextPage()}
      />
    </div>
  );
}
