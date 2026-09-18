import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { InfiniteLedgerList } from "@/components/shared/infinite-ledger-list";

describe("InfiniteLedgerList Component (TC-FE-08, TC-FE-09, TC-FE-10)", () => {
  it("TC-FE-08: renders loading state initially when isLoading is true", () => {
    render(
      <InfiniteLedgerList
        items={[]}
        isLoading={true}
        isError={false}
        hasNextPage={false}
        onFetchNextPage={vi.fn()}
      />
    );

    expect(screen.getByTestId("ledger-loading-skeleton")).toBeInTheDocument();
  });

  it("TC-FE-08: renders the list of financial transaction items when loaded", () => {
    const mockItems = [
      {
        id: "tx-1",
        description: "Compra Repuesto Filtro",
        amount: "150.00",
        currency: "USD",
        txType: "EXPENSE",
        status: "COMMITTED",
        category: "MAINTENANCE",
        createdAt: new Date().toISOString(),
      },
      {
        id: "tx-2",
        description: "Cobro Hito Proyecto A",
        amount: "3000.00",
        currency: "USD",
        txType: "INCOME",
        status: "COMMITTED",
        category: "CONSULTING",
        createdAt: new Date().toISOString(),
      },
    ];

    render(
      <InfiniteLedgerList
        items={mockItems}
        isLoading={false}
        isError={false}
        hasNextPage={false}
        onFetchNextPage={vi.fn()}
      />
    );

    expect(screen.getByText("Compra Repuesto Filtro")).toBeInTheDocument();
    expect(screen.getByText("Cobro Hito Proyecto A")).toBeInTheDocument();
  });

  it("TC-FE-10: renders empty state illustration when list has 0 items and not loading", () => {
    render(
      <InfiniteLedgerList
        items={[]}
        isLoading={false}
        isError={false}
        hasNextPage={false}
        onFetchNextPage={vi.fn()}
      />
    );

    expect(screen.getByText(/no hay transacciones registradas/i)).toBeInTheDocument();
  });

  it("TC-FE-10: renders error state and provides a Retry button", () => {
    const handleRetry = vi.fn();

    render(
      <InfiniteLedgerList
        items={[]}
        isLoading={false}
        isError={true}
        errorMessage="Error de conexión con la base de datos"
        onRetry={handleRetry}
        hasNextPage={false}
        onFetchNextPage={vi.fn()}
      />
    );

    expect(screen.getByText(/error de conexión con la base de datos/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: /reintentar/i });
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});
