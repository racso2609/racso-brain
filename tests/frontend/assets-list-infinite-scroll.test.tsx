import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { AssetList, type AssetItemDisplay } from "@/components/assets/asset-list";

describe("AssetList Component with Infinite Scroll (TC-FE-ASSETS-01, TC-FE-ASSETS-02)", () => {
  it("renders loading skeleton state initially when isLoading is true", () => {
    render(
      <AssetList
        items={[]}
        isLoading={true}
        isError={false}
        hasNextPage={false}
        onFetchNextPage={vi.fn()}
      />
    );

    expect(screen.getByTestId("assets-loading-skeleton")).toBeInTheDocument();
  });

  it("renders list of assets with name, type, and status badge", () => {
    const mockAssets: AssetItemDisplay[] = [
      {
        id: "asset-1",
        name: "Camión Isuzu NPR",
        type: "VEHICLE",
        status: "OPERATIONAL",
        serialNumber: "VIN-998811",
        createdAt: new Date().toISOString(),
      },
      {
        id: "asset-2",
        name: "Chiller Central 50 Ton",
        type: "HVAC",
        status: "UNDER_MAINTENANCE",
        serialNumber: "SN-CHILLER-01",
        createdAt: new Date().toISOString(),
      },
    ];

    render(
      <AssetList
        items={mockAssets}
        isLoading={false}
        isError={false}
        hasNextPage={false}
        onFetchNextPage={vi.fn()}
      />
    );

    expect(screen.getByText("Camión Isuzu NPR")).toBeInTheDocument();
    expect(screen.getByText("Chiller Central 50 Ton")).toBeInTheDocument();
    expect(screen.getByText("Operativo")).toBeInTheDocument();
    expect(screen.getByText("En Mantenimiento")).toBeInTheDocument();
    expect(screen.getByText("VIN-998811")).toBeInTheDocument();
  });

  it("renders empty state when there are no assets and not loading", () => {
    render(
      <AssetList
        items={[]}
        isLoading={false}
        isError={false}
        hasNextPage={false}
        onFetchNextPage={vi.fn()}
      />
    );

    expect(screen.getByText(/no se encontraron activos/i)).toBeInTheDocument();
    expect(screen.getByText(/comienza registrando vehículos/i)).toBeInTheDocument();
  });

  it("renders error state with retry button when isError is true", () => {
    const handleRetry = vi.fn();

    render(
      <AssetList
        items={[]}
        isLoading={false}
        isError={true}
        errorMessage="Error de red al consultar activos"
        onRetry={handleRetry}
        hasNextPage={false}
        onFetchNextPage={vi.fn()}
      />
    );

    expect(screen.getByText(/error de red al consultar activos/i)).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: /reintentar/i });
    fireEvent.click(retryButton);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});
