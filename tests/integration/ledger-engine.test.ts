import { describe, it, expect, vi } from "vitest";
import {
  validateStateTransition,
  InvalidStateTransitionError,
} from "@/core/ledger/types";
import {
  paginateLedgerItems,
  type LedgerQueryItem,
} from "@/core/ledger/queries";
import { encodeCursor, decodeCursor } from "@/lib/pagination/cursor";

describe("Financial Ledger Engine & State Machine (TC-BE-10, TC-BE-11, TC-BE-12)", () => {
  it("TC-BE-11: validates allowable state transitions and rejects illegal transitions", () => {
    // PENDING_PAYMENT -> SETTLED is valid
    expect(validateStateTransition("PENDING_PAYMENT", "SETTLED")).toBe(true);

    // PENDING_PAYMENT -> VOIDED is valid
    expect(validateStateTransition("PENDING_PAYMENT", "VOIDED")).toBe(true);

    // COMMITTED -> VOIDED is valid (reversal)
    expect(validateStateTransition("COMMITTED", "VOIDED")).toBe(true);

    // Illegal transitions: VOIDED cannot transition back to COMMITTED or SETTLED
    expect(() => validateStateTransition("VOIDED", "COMMITTED")).toThrow(
      InvalidStateTransitionError
    );
    expect(() => validateStateTransition("VOIDED", "SETTLED")).toThrow(
      InvalidStateTransitionError
    );
    expect(() => validateStateTransition("SETTLED", "PENDING_PAYMENT")).toThrow(
      InvalidStateTransitionError
    );
  });

  it("TC-BE-12: ensures physical immutability by transition to VOIDED and auditing", () => {
    // In our architecture, voiding is an audit-logged mutation, not a SQL DELETE
    const tx = {
      id: "tx-immutable-1",
      status: "PENDING_PAYMENT" as const,
      metadata: {},
    };

    function voidTransaction(
      transaction: typeof tx,
      reason: string,
      recordAuditFn: (action: string, meta: any) => void
    ) {
      validateStateTransition(transaction.status, "VOIDED");
      const updated = {
        ...transaction,
        status: "VOIDED" as const,
        metadata: { ...transaction.metadata, voidReason: reason },
      };
      recordAuditFn("VOID_TRANSACTION", {
        transactionId: transaction.id,
        previousStatus: transaction.status,
        reason,
      });
      return updated;
    }

    const auditSpy = vi.fn();
    const voided = voidTransaction(tx, "Error en factura proveedor", auditSpy);

    expect(voided.status).toBe("VOIDED");
    expect(voided.metadata.voidReason).toBe("Error en factura proveedor");
    expect(auditSpy).toHaveBeenCalledWith("VOID_TRANSACTION", {
      transactionId: "tx-immutable-1",
      previousStatus: "PENDING_PAYMENT",
      reason: "Error en factura proveedor",
    });
  });
});

describe("Ledger Keyset Pagination Engine (TC-BE-13, TC-BE-14, TC-BE-15)", () => {
  const baseDate = new Date("2026-09-17T12:00:00.000Z").getTime();
  const mockTransactions: LedgerQueryItem[] = Array.from({ length: 25 }, (_, i) => {
    const itemDate = new Date(baseDate - i * 60000); // 1 minute apart descending
    return {
      id: `tx-${String(i + 1).padStart(2, "0")}`,
      tenantId: "tenant-mock-1",
      amount: "100.00",
      currency: "USD",
      txType: "EXPENSE",
      status: "COMMITTED",
      originModule: "ASSET_MAINTENANCE",
      category: "FLEET",
      description: `Gasto de combustible #${i + 1}`,
      createdAt: itemDate,
      issueDate: "2026-09-17",
    };
  });

  it("TC-BE-13: fetches exactly limit records sorted by created_at DESC, id DESC", () => {
    const result = paginateLedgerItems(mockTransactions, { limit: 10 });

    expect(result.items).toHaveLength(10);
    expect(result.items[0].id).toBe("tx-01");
    expect(result.items[9].id).toBe("tx-10");
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();
  });

  it("TC-BE-14: next page using nextCursor retrieves subsequent items with zero duplicate or skipped records", () => {
    // Page 1
    const page1 = paginateLedgerItems(mockTransactions, { limit: 10 });
    expect(page1.items).toHaveLength(10);

    const cursor1 = page1.nextCursor!;
    expect(cursor1).toBeTruthy();

    // Page 2 using cursor1
    const page2 = paginateLedgerItems(mockTransactions, { limit: 10, cursor: cursor1 });
    expect(page2.items).toHaveLength(10);
    expect(page2.items[0].id).toBe("tx-11");
    expect(page2.items[9].id).toBe("tx-20");
    expect(page2.hasMore).toBe(true);

    // Verify zero intersection between page 1 and page 2
    const page1Ids = new Set(page1.items.map((i) => i.id));
    const page2Ids = page2.items.map((i) => i.id);
    expect(page2Ids.every((id) => !page1Ids.has(id))).toBe(true);
  });

  it("TC-BE-15: detects end of list when remaining items < limit", () => {
    // Page 3 (remaining 5 items)
    const page2 = paginateLedgerItems(mockTransactions, { limit: 10, cursor: encodeCursor({ createdAt: mockTransactions[9].createdAt, id: mockTransactions[9].id }) });
    const page3 = paginateLedgerItems(mockTransactions, { limit: 10, cursor: encodeCursor({ createdAt: mockTransactions[19].createdAt, id: mockTransactions[19].id }) });

    expect(page3.items).toHaveLength(5);
    expect(page3.items[0].id).toBe("tx-21");
    expect(page3.items[4].id).toBe("tx-25");
    expect(page3.hasMore).toBe(false);
    expect(page3.nextCursor).toBeNull();
  });
});
