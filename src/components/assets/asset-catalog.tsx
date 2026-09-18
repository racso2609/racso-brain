"use client";

import React, { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { AssetList, type AssetItemDisplay } from "./asset-list";
import { AssetFilters } from "./asset-filters";
import { CreateAssetModal } from "./create-asset-modal";
import { Button } from "@/components/ui/button";
import { Plus, Truck } from "lucide-react";
import type { PaginatedResult } from "@/lib/pagination/types";
import type { Asset } from "@/db/schema/assets";
import type { AssetType, AssetStatus } from "@/core/assets/types";

interface FetchAssetsParams {
  pageParam?: string;
  type?: AssetType | "ALL";
  status?: AssetStatus | "ALL";
  search?: string;
}

async function fetchAssetsPage({ pageParam, type, status, search }: FetchAssetsParams) {
  const url = new URL("/api/assets", window.location.origin);
  url.searchParams.set("limit", "10");
  if (pageParam) {
    url.searchParams.set("cursor", pageParam);
  }
  if (type && type !== "ALL") {
    url.searchParams.set("type", type);
  }
  if (status && status !== "ALL") {
    url.searchParams.set("status", status);
  }
  if (search && search.trim()) {
    url.searchParams.set("search", search.trim());
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error("Error al obtener los activos");
  }
  return (await res.json()) as PaginatedResult<Asset>;
}

export function AssetCatalog() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<AssetType | "ALL">("ALL");
  const [selectedStatus, setSelectedStatus] = useState<AssetStatus | "ALL">("ALL");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
    queryKey: ["assets-list", selectedType, selectedStatus, search],
    queryFn: ({ pageParam }) =>
      fetchAssetsPage({
        pageParam,
        type: selectedType,
        status: selectedStatus,
        search,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
  });

  const allItems: AssetItemDisplay[] =
    data?.pages.flatMap((page) =>
      page.items.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        status: item.status,
        serialNumber: item.serialNumber,
        createdAt: item.createdAt,
        customFields: item.customFields as Record<string, unknown>,
      }))
    ) ?? [];

  const handleCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["assets-list"] });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Catálogo de Activos
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Flota vehicular, maquinaria, HVAC e infraestructura física.
            </p>
          </div>
        </div>

        <Button
          data-testid="button-open-create-asset"
          onClick={() => setIsCreateModalOpen(true)}
          className="gap-2 shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nuevo Activo
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <AssetFilters
        search={search}
        onSearchChange={setSearch}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
      />

      {/* Infinite Asset List */}
      <AssetList
        items={allItems}
        isLoading={isLoading}
        isError={isError}
        errorMessage={error?.message}
        onRetry={() => refetch()}
        hasNextPage={Boolean(hasNextPage)}
        isFetchingNextPage={isFetchingNextPage}
        onFetchNextPage={() => fetchNextPage()}
      />

      {/* Create Modal */}
      <CreateAssetModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreated}
      />
    </div>
  );
}
