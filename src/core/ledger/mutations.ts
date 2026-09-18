import { db } from "@/db";
import { financialTransactions, insertFinancialTransactionSchema } from "@/db/schema";
import { recordAuditLog } from "@/core/audit/service";
import {
  validateStateTransition,
  type CreateTransactionParams,
} from "./types";
import { eq, and } from "drizzle-orm";
import { NotFoundError } from "@/core/rbac/guards";

export async function createLedgerTransaction(params: CreateTransactionParams) {
  // 1. Validate inputs strictly with Zod
  const validated = insertFinancialTransactionSchema.parse({
    tenantId: params.tenantId,
    txType: params.txType,
    status: params.status ?? (params.txType === "RECEIVABLE" || params.txType === "PAYABLE" ? "PENDING_PAYMENT" : "COMMITTED"),
    amount: params.amount,
    currency: params.currency ?? "USD",
    issueDate: params.issueDate ?? new Date().toISOString().split("T")[0],
    dueDate: params.dueDate ?? null,
    originModule: params.originModule,
    originId: params.originId ?? null,
    category: params.category,
    description: params.description,
    metadata: params.metadata ?? {},
    createdBy: params.createdBy ?? null,
  });

  return await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(financialTransactions)
      .values(validated)
      .returning();

    await recordAuditLog({
      tenantId: inserted.tenantId,
      userId: inserted.createdBy,
      action: "CREATE_TRANSACTION",
      entityType: "financial_transaction",
      entityId: inserted.id,
      newData: inserted as unknown as Record<string, unknown>,
    });

    return inserted;
  });
}

export async function voidLedgerTransaction(params: {
  tenantId: string;
  transactionId: string;
  reason: string;
  userId?: string | null;
}) {
  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(financialTransactions)
      .where(
        and(
          eq(financialTransactions.id, params.transactionId),
          eq(financialTransactions.tenantId, params.tenantId)
        )
      );

    if (!existing) {
      throw new NotFoundError(`Financial transaction ${params.transactionId} not found in this tenant`);
    }

    // Validate state machine transition
    validateStateTransition(existing.status, "VOIDED");

    const updatedMetadata = {
      ...(existing.metadata as Record<string, unknown>),
      voidReason: params.reason,
      voidedAt: new Date().toISOString(),
      voidedBy: params.userId ?? null,
    };

    const [updated] = await tx
      .update(financialTransactions)
      .set({
        status: "VOIDED",
        metadata: updatedMetadata,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(financialTransactions.id, params.transactionId),
          eq(financialTransactions.tenantId, params.tenantId)
        )
      )
      .returning();

    await recordAuditLog({
      tenantId: params.tenantId,
      userId: params.userId,
      action: "VOID_TRANSACTION",
      entityType: "financial_transaction",
      entityId: updated.id,
      oldData: existing as unknown as Record<string, unknown>,
      newData: updated as unknown as Record<string, unknown>,
    });

    return updated;
  });
}
