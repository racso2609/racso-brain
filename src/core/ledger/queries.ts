import { db } from "@/db";
import { financialTransactions, type FinancialTransaction } from "@/db/schema/ledger";
import { eq, and, or, lt, desc } from "drizzle-orm";
import { encodeCursor, decodeCursor } from "@/lib/pagination/cursor";
import type { CursorPaginationParams, PaginatedResult } from "@/lib/pagination/types";

export interface LedgerQueryItem {
  id: string;
  tenantId: string;
  txType: string;
  status: string;
  amount: string;
  currency: string;
  issueDate: string;
  dueDate?: string | null;
  settledAt?: Date | null;
  originModule: string;
  originId?: string | null;
  category: string;
  description: string;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

/**
 * Pure in-memory keyset pagination helper for items already sorted by created_at DESC, id DESC
 */
export function paginateLedgerItems<T extends { id: string; createdAt: Date | string }>(
  allItems: T[],
  params: { limit?: number; cursor?: string }
): PaginatedResult<T> {
  const limit = params.limit ?? 10;
  let filtered = allItems;

  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded) {
      const cursorTime = new Date(decoded.createdAt).getTime();
      filtered = allItems.filter((item) => {
        const itemTime = new Date(item.createdAt).getTime();
        if (itemTime < cursorTime) return true;
        if (itemTime === cursorTime && item.id < decoded.id) return true;
        return false;
      });
    }
  }

  const items = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    nextCursor = encodeCursor({
      createdAt: lastItem.createdAt,
      id: lastItem.id,
    });
  }

  return {
    items,
    nextCursor,
    hasMore,
  };
}

/**
 * Database query with keyset pagination over PostgreSQL index (tenant_id, created_at DESC, id DESC)
 */
export async function getLedgerTransactions(
  tenantId: string,
  params: CursorPaginationParams
): Promise<PaginatedResult<FinancialTransaction>> {
  const limit = params.limit ?? 10;
  const conditions = [eq(financialTransactions.tenantId, tenantId)];

  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded) {
      const cursorDate = new Date(decoded.createdAt);
      conditions.push(
        or(
          lt(financialTransactions.createdAt, cursorDate),
          and(
            eq(financialTransactions.createdAt, cursorDate),
            lt(financialTransactions.id, decoded.id)
          )
        )!
      );
    }
  }

  // Fetch limit + 1 to reliably detect hasMore
  const rows = await db
    .select()
    .from(financialTransactions)
    .where(and(...conditions))
    .orderBy(desc(financialTransactions.createdAt), desc(financialTransactions.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    nextCursor = encodeCursor({
      createdAt: lastItem.createdAt,
      id: lastItem.id,
    });
  }

  return {
    items,
    nextCursor,
    hasMore,
  };
}
