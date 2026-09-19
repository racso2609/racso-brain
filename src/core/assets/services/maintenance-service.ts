import { db } from "@/db";
import {
  assets,
  maintenanceOrders,
  maintenancePlans,
  financialTransactions,
  insertMaintenanceOrderSchema,
  insertFinancialTransactionSchema,
  type MaintenanceOrder,
  type FinancialTransaction,
} from "@/db/schema";
import {
  validateOrderStateTransition,
  InvalidOrderStateTransitionError,
} from "@/core/assets/maintenance-rules";
import type {
  MaintenanceOrderType,
  MaintenanceOrderStatus,
  MaintenancePaymentTerms,
  PartReplaced,
} from "@/core/assets/types";
import { eq, and, or, lt, desc } from "drizzle-orm";
import { encodeCursor, decodeCursor } from "@/lib/pagination/cursor";
import type { PaginatedResult } from "@/lib/pagination/types";
import { recordAuditLog } from "@/core/audit/service";
import { validateStateTransition } from "@/core/ledger/types";
import type { TransactionClient } from "@/core/tenancy/provisioning";

export interface CreateMaintenanceOrderInput {
  tenantId: string;
  assetId: string;
  planId?: string | null;
  orderType: MaintenanceOrderType;
  title: string;
  description?: string | null;
  cost?: string | number;
  currency?: string;
  providerName?: string | null;
  invoiceNumber?: string | null;
  paymentTerms?: MaintenancePaymentTerms;
  serviceDate?: string | Date;
  usageAtService?: string | number | null;
  partsReplaced?: PartReplaced[];
  createdBy?: string | null;
}

export interface CreateMaintenanceOrderResult {
  order: MaintenanceOrder;
  financialTransaction: FinancialTransaction | null;
}

function calculateDueDate(serviceDateStr: string, terms: MaintenancePaymentTerms): string | null {
  const daysToAdd =
    terms === "CREDIT_15_DAYS"
      ? 15
      : terms === "CREDIT_30_DAYS"
      ? 30
      : terms === "CREDIT_60_DAYS"
      ? 60
      : 0;

  if (daysToAdd === 0) return null;

  const date = new Date(serviceDateStr + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date.toISOString().split("T")[0];
}

export async function createMaintenanceOrder(
  input: CreateMaintenanceOrderInput
): Promise<CreateMaintenanceOrderResult> {
  const costNum =
    typeof input.cost === "string" ? parseFloat(input.cost) : (input.cost ?? 0);
  const costStr = costNum.toFixed(2);
  const currency = input.currency ?? "USD";
  const paymentTerms = input.paymentTerms ?? "IMMEDIATE";

  const serviceDateStr =
    input.serviceDate instanceof Date
      ? input.serviceDate.toISOString().split("T")[0]
      : input.serviceDate ?? new Date().toISOString().split("T")[0];

  const dueDateStr = calculateDueDate(serviceDateStr, paymentTerms);

  return await db.transaction(async (tx) => {
    // 1. Fetch asset to ensure it exists and get its metadata
    const [asset] = await tx
      .select()
      .from(assets)
      .where(and(eq(assets.id, input.assetId), eq(assets.tenantId, input.tenantId)));

    if (!asset) {
      throw new Error(`Asset ${input.assetId} not found for tenant ${input.tenantId}`);
    }

    // 2. Insert order first to have an order ID
    const validatedOrder = insertMaintenanceOrderSchema.parse({
      tenantId: input.tenantId,
      assetId: input.assetId,
      planId: input.planId ?? null,
      orderType: input.orderType,
      status: "SCHEDULED",
      title: input.title,
      description: input.description ?? null,
      cost: costStr,
      currency,
      providerName: input.providerName ?? null,
      invoiceNumber: input.invoiceNumber ?? null,
      paymentTerms,
      serviceDate: serviceDateStr,
      dueDate: dueDateStr,
      usageAtService: input.usageAtService ? String(input.usageAtService) : null,
      partsReplaced: input.partsReplaced ?? [],
      createdBy: input.createdBy ?? null,
    });

    const [order] = await tx
      .insert(maintenanceOrders)
      .values(validatedOrder)
      .returning();

    let financialTx: FinancialTransaction | null = null;

    // 3. If cost > 0, atomically emit into financial_transactions
    if (costNum > 0) {
      const isCredit = paymentTerms.startsWith("CREDIT_");
      const txType = isCredit ? "PAYABLE" : "EXPENSE";
      const txStatus = isCredit ? "PENDING_PAYMENT" : "COMMITTED";

      const validatedFinTx = insertFinancialTransactionSchema.parse({
        tenantId: input.tenantId,
        txType,
        status: txStatus,
        amount: costStr,
        currency,
        issueDate: serviceDateStr,
        dueDate: dueDateStr,
        originModule: "ASSET_MAINTENANCE",
        originId: order.id,
        category: `${asset.type}_MAINTENANCE`,
        description: `Mantenimiento ${input.orderType}: ${asset.name} - ${input.title}`,
        metadata: {
          assetId: asset.id,
          assetName: asset.name,
          providerName: input.providerName ?? null,
          invoiceNumber: input.invoiceNumber ?? null,
          partsCount: input.partsReplaced?.length ?? 0,
        },
        createdBy: input.createdBy ?? null,
      });

      const [createdTx] = await tx
        .insert(financialTransactions)
        .values(validatedFinTx)
        .returning();

      financialTx = createdTx;

      // Update order with financialTransactionId
      await tx
        .update(maintenanceOrders)
        .set({ financialTransactionId: createdTx.id })
        .where(eq(maintenanceOrders.id, order.id));

      order.financialTransactionId = createdTx.id;

      await recordAuditLog({
        tenantId: input.tenantId,
        userId: input.createdBy,
        action: "CREATE_MAINTENANCE_FINANCIAL_TX",
        entityType: "financial_transaction",
        entityId: createdTx.id,
        newData: createdTx as unknown as Record<string, unknown>,
      });
    }

    // 4. If the order is created from a plan with a service reading,
    // reset the plan baseline so the health semaphore restarts from here.
    if (input.planId && input.usageAtService) {
      const [planRow] = await tx
        .select()
        .from(maintenancePlans)
        .where(and(eq(maintenancePlans.id, input.planId), eq(maintenancePlans.tenantId, input.tenantId)));

      if (planRow) {
        const usageAtServiceStr = String(input.usageAtService);
        const baselineDate = new Date(serviceDateStr + "T00:00:00Z");

        const [updatedPlan] = await tx
          .update(maintenancePlans)
          .set({
            baselineUsage: usageAtServiceStr,
            baselineDate,
            updatedAt: new Date(),
          })
          .where(eq(maintenancePlans.id, planRow.id))
          .returning();

        await recordAuditLog({
          tenantId: input.tenantId,
          userId: input.createdBy,
          action: "UPDATE_MAINTENANCE_PLAN",
          entityType: "maintenance_plan",
          entityId: planRow.id,
          oldData: planRow as unknown as Record<string, unknown>,
          newData: updatedPlan as unknown as Record<string, unknown>,
        });
      }
    }

    await recordAuditLog({
      tenantId: input.tenantId,
      userId: input.createdBy,
      action: "CREATE_MAINTENANCE_ORDER",
      entityType: "maintenance_order",
      entityId: order.id,
      newData: order as unknown as Record<string, unknown>,
    });

    return {
      order,
      financialTransaction: financialTx,
    };
  });
}

async function voidFinancialTransaction(
  tx: TransactionClient,
  txId: string,
  tenantId: string,
  reason: string,
  userId: string | null | undefined
): Promise<FinancialTransaction | null> {
  const [existingTx] = await tx
    .select()
    .from(financialTransactions)
    .where(
      and(
        eq(financialTransactions.id, txId),
        eq(financialTransactions.tenantId, tenantId)
      )
    );

  if (!existingTx) return null;

  if (existingTx.status === "VOIDED") return existingTx;

  validateStateTransition(existingTx.status, "VOIDED");

  const updatedMetadata = {
    ...(existingTx.metadata as Record<string, unknown>),
    voidReason: reason,
    voidedAt: new Date().toISOString(),
    voidedBy: userId ?? null,
  };

  const [txRow] = await tx
    .update(financialTransactions)
    .set({
      status: "VOIDED",
      metadata: updatedMetadata,
      updatedAt: new Date(),
    })
    .where(eq(financialTransactions.id, existingTx.id))
    .returning();

  await recordAuditLog({
    tenantId,
    userId,
    action: "VOID_TRANSACTION",
    entityType: "financial_transaction",
    entityId: txRow.id,
    oldData: existingTx as unknown as Record<string, unknown>,
    newData: txRow as unknown as Record<string, unknown>,
  });

  return txRow;
}

export interface CancelOrderParams {
  tenantId: string;
  orderId: string;
  reason: string;
  userId?: string | null;
}

export async function cancelMaintenanceOrder(
  params: CancelOrderParams
): Promise<{ order: MaintenanceOrder; financialTransaction: FinancialTransaction | null }> {
  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(maintenanceOrders)
      .where(
        and(
          eq(maintenanceOrders.id, params.orderId),
          eq(maintenanceOrders.tenantId, params.tenantId)
        )
      );

    if (!existing) {
      throw new Error(`Maintenance order ${params.orderId} not found in this tenant`);
    }

    validateOrderStateTransition(existing.status, "CANCELLED");

    let voidedTx: FinancialTransaction | null = null;

    if (existing.financialTransactionId) {
      voidedTx = await voidFinancialTransaction(
        tx,
        existing.financialTransactionId,
        params.tenantId,
        params.reason,
        params.userId
      );
    }

    const [updatedOrder] = await tx
      .update(maintenanceOrders)
      .set({
        status: "CANCELLED",
        updatedAt: new Date(),
      })
      .where(eq(maintenanceOrders.id, existing.id))
      .returning();

    await recordAuditLog({
      tenantId: params.tenantId,
      userId: params.userId,
      action: "CANCEL_MAINTENANCE_ORDER",
      entityType: "maintenance_order",
      entityId: updatedOrder.id,
      oldData: existing as unknown as Record<string, unknown>,
      newData: updatedOrder as unknown as Record<string, unknown>,
    });

    return {
      order: updatedOrder,
      financialTransaction: voidedTx,
    };
  });
}

export interface DeleteOrderParams {
  tenantId: string;
  orderId: string;
  userId?: string | null;
}

export async function deleteMaintenanceOrder(
  params: DeleteOrderParams
): Promise<{ deletedOrderId: string; deletedTransactionId: string | null }> {
  return await db.transaction(async (tx) => {
    // 1. Fetch order
    const [existing] = await tx
      .select()
      .from(maintenanceOrders)
      .where(
        and(
          eq(maintenanceOrders.id, params.orderId),
          eq(maintenanceOrders.tenantId, params.tenantId)
        )
      );

    if (!existing) {
      throw new Error(`Maintenance order ${params.orderId} not found in this tenant`);
    }

    let deletedTxId: string | null = null;

    // 2. If financialTransactionId exists, void it (delete cascades to voided tx)
    if (existing.financialTransactionId) {
      const voidedTx = await voidFinancialTransaction(
        tx,
        existing.financialTransactionId,
        params.tenantId,
        "Order deleted",
        params.userId
      );
      deletedTxId = voidedTx ? voidedTx.id : null;
    }

    // 3. DELETE order (trigger auto-deletes voided tx)
    await tx
      .delete(maintenanceOrders)
      .where(eq(maintenanceOrders.id, existing.id));

    // 4. Audit log
    await recordAuditLog({
      tenantId: params.tenantId,
      userId: params.userId,
      action: "DELETE_MAINTENANCE_ORDER",
      entityType: "maintenance_order",
      entityId: existing.id,
      oldData: existing as unknown as Record<string, unknown>,
      newData: {} as unknown as Record<string, unknown>,
    });

    return {
      deletedOrderId: existing.id,
      deletedTransactionId: deletedTxId,
    };
  });
}

export interface CompleteOrderParams {
  tenantId: string;
  orderId: string;
  usageAtService?: string | number | null;
  partsReplaced?: PartReplaced[];
  userId?: string | null;
}

export async function completeMaintenanceOrder(
  params: CompleteOrderParams
): Promise<{ order: MaintenanceOrder }> {
  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(maintenanceOrders)
      .where(
        and(
          eq(maintenanceOrders.id, params.orderId),
          eq(maintenanceOrders.tenantId, params.tenantId)
        )
      );

    if (!existing) {
      throw new Error(`Maintenance order ${params.orderId} not found in this tenant`);
    }

    validateOrderStateTransition(existing.status, "COMPLETED");

    const [updated] = await tx
      .update(maintenanceOrders)
      .set({
        status: "COMPLETED",
        completedAt: new Date(),
        usageAtService: params.usageAtService
          ? String(params.usageAtService)
          : existing.usageAtService,
        partsReplaced: params.partsReplaced ?? existing.partsReplaced,
        updatedAt: new Date(),
      })
      .where(eq(maintenanceOrders.id, existing.id))
      .returning();

    await recordAuditLog({
      tenantId: params.tenantId,
      userId: params.userId,
      action: "COMPLETE_MAINTENANCE_ORDER",
      entityType: "maintenance_order",
      entityId: updated.id,
      oldData: existing as unknown as Record<string, unknown>,
      newData: updated as unknown as Record<string, unknown>,
    });

    return { order: updated };
  });
}

export interface ListMaintenanceOrdersParams {
  tenantId: string;
  assetId?: string;
  status?: MaintenanceOrderStatus;
  cursor?: string;
  limit?: number;
}

export async function listMaintenanceOrders(
  params: ListMaintenanceOrdersParams
): Promise<PaginatedResult<MaintenanceOrder>> {
  const limit = params.limit ?? 10;
  const conditions = [eq(maintenanceOrders.tenantId, params.tenantId)];

  if (params.assetId) {
    conditions.push(eq(maintenanceOrders.assetId, params.assetId));
  }

  if (params.status) {
    conditions.push(eq(maintenanceOrders.status, params.status));
  }

  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded) {
      const cursorDate = new Date(decoded.createdAt);
      conditions.push(
        or(
          lt(maintenanceOrders.createdAt, cursorDate),
          and(eq(maintenanceOrders.createdAt, cursorDate), lt(maintenanceOrders.id, decoded.id))
        )!
      );
    }
  }

  const rows = await db
    .select()
    .from(maintenanceOrders)
    .where(and(...conditions))
    .orderBy(desc(maintenanceOrders.createdAt), desc(maintenanceOrders.id))
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
