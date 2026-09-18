import { NextResponse, type NextRequest } from "next/server";
import { resolveAuthAndTenant, type AssetRouteAuthDeps } from "@/core/assets/api-helper";
import {
  listAssets,
  createAsset,
  getAssetById,
  updateAsset,
} from "@/core/assets/services/asset-service";
import {
  listUsageLogs,
  recordUsageLog,
  getLatestUsageLog,
  InvalidTelemetryValueError,
} from "@/core/assets/services/usage-log-service";
import {
  listMaintenanceOrders,
  createMaintenanceOrder,
  cancelMaintenanceOrder,
  completeMaintenanceOrder,
} from "@/core/assets/services/maintenance-service";
import { evaluateAssetMaintenanceHealth } from "@/core/assets/maintenance-rules";
import { CursorPaginationParamsSchema } from "@/lib/pagination/cursor";
import { db } from "@/db";
import { maintenancePlans, maintenanceOrders } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { z } from "zod";
import type {
  AssetType,
  AssetStatus,
  AssetUsageMetricType,
  MaintenanceOrderType,
  MaintenanceOrderStatus,
  MaintenancePaymentTerms,
} from "@/core/assets/types";

// ==========================================
// 1. /api/assets
// ==========================================

const createAssetBodySchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["VEHICLE", "HVAC", "HEAVY_MACHINERY", "EQUIPMENT", "FACILITY"]),
  status: z.enum(["OPERATIONAL", "UNDER_MAINTENANCE", "DECOMMISSIONED"]).optional(),
  serialNumber: z.string().nullable().optional(),
  customFields: z.record(z.unknown()).optional(),
});

export async function handleGetAssets(
  request: Request | NextRequest,
  deps?: AssetRouteAuthDeps
) {
  try {
    const authResult = await resolveAuthAndTenant("assets:read", deps);
    if (authResult.errorResponse) return authResult.errorResponse;

    const searchParams = new URL(request.url).searchParams;
    const pagination = CursorPaginationParamsSchema.parse({
      limit: searchParams.get("limit") || 10,
      cursor: searchParams.get("cursor") || undefined,
    });

    const type = searchParams.get("type") as AssetType | null;
    const status = searchParams.get("status") as AssetStatus | null;
    const search = searchParams.get("search") || undefined;

    const result = await listAssets({
      tenantId: authResult.tenantId,
      type: type || undefined,
      status: status || undefined,
      search,
      cursor: pagination.cursor,
      limit: pagination.limit,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("API GET /api/assets error:", error);
    return NextResponse.json(
      { error: "Error al listar los activos" },
      { status: 500 }
    );
  }
}

export async function handlePostAssets(
  request: Request | NextRequest,
  deps?: AssetRouteAuthDeps
) {
  try {
    const authResult = await resolveAuthAndTenant("assets:write", deps);
    if (authResult.errorResponse) return authResult.errorResponse;

    const body = await request.json();
    const parsed = createAssetBodySchema.parse(body);

    const asset = await createAsset({
      tenantId: authResult.tenantId,
      name: parsed.name,
      type: parsed.type,
      status: parsed.status,
      serialNumber: parsed.serialNumber,
      customFields: parsed.customFields,
      createdBy: authResult.user.id,
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos de validación inválidos", details: error.errors },
        { status: 400 }
      );
    }
    console.error("API POST /api/assets error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al registrar el activo" },
      { status: 500 }
    );
  }
}

// ==========================================
// 2. /api/assets/[id]
// ==========================================

const updateAssetBodySchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["OPERATIONAL", "UNDER_MAINTENANCE", "DECOMMISSIONED"]).optional(),
  serialNumber: z.string().nullable().optional(),
  customFields: z.record(z.unknown()).optional(),
});

export async function handleGetAssetDetail(
  request: Request | NextRequest,
  assetId: string,
  deps?: AssetRouteAuthDeps
) {
  try {
    const authResult = await resolveAuthAndTenant("assets:read", deps);
    if (authResult.errorResponse) return authResult.errorResponse;

    const asset = await getAssetById(authResult.tenantId, assetId);
    if (!asset) {
      return NextResponse.json({ error: "Activo no encontrado" }, { status: 404 });
    }

    const plans = await db
      .select()
      .from(maintenancePlans)
      .where(
        and(
          eq(maintenancePlans.tenantId, authResult.tenantId),
          eq(maintenancePlans.isActive, true),
          or(
            eq(maintenancePlans.assetId, asset.id),
            eq(maintenancePlans.assetType, asset.type as any)
          )
        )
      );

    const latestUsageLog = await getLatestUsageLog(authResult.tenantId, asset.id);

    const completedOrders = await db
      .select({
        planId: maintenanceOrders.planId,
        usageAtService: maintenanceOrders.usageAtService,
        serviceDate: maintenanceOrders.serviceDate,
      })
      .from(maintenanceOrders)
      .where(
        and(
          eq(maintenanceOrders.tenantId, authResult.tenantId),
          eq(maintenanceOrders.assetId, asset.id),
          eq(maintenanceOrders.status, "COMPLETED")
        )
      );

    const health = evaluateAssetMaintenanceHealth({
      asset,
      plans,
      latestUsageLog,
      lastCompletedOrders: completedOrders,
    });

    return NextResponse.json({
      asset,
      health,
      latestUsageLog,
    });
  } catch (error: unknown) {
    console.error(`API GET /api/assets/${assetId} error:`, error);
    return NextResponse.json(
      { error: "Error al obtener el detalle del activo" },
      { status: 500 }
    );
  }
}

export async function handlePatchAsset(
  request: Request | NextRequest,
  assetId: string,
  deps?: AssetRouteAuthDeps
) {
  try {
    const authResult = await resolveAuthAndTenant("assets:write", deps);
    if (authResult.errorResponse) return authResult.errorResponse;

    const body = await request.json();
    const parsed = updateAssetBodySchema.parse(body);

    const updated = await updateAsset({
      tenantId: authResult.tenantId,
      assetId,
      name: parsed.name,
      status: parsed.status as AssetStatus | undefined,
      serialNumber: parsed.serialNumber,
      customFields: parsed.customFields,
      userId: authResult.user.id,
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos de validación inválidos", details: error.errors },
        { status: 400 }
      );
    }
    console.error(`API PATCH /api/assets/${assetId} error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al actualizar el activo" },
      { status: 500 }
    );
  }
}

export async function handleDeleteAsset(
  request: Request | NextRequest,
  assetId: string,
  deps?: AssetRouteAuthDeps
) {
  try {
    const authResult = await resolveAuthAndTenant("assets:write", deps);
    if (authResult.errorResponse) return authResult.errorResponse;

    const updated = await updateAsset({
      tenantId: authResult.tenantId,
      assetId,
      status: "DECOMMISSIONED",
      userId: authResult.user.id,
    });

    return NextResponse.json({ message: "Activo dado de baja correctamente", asset: updated });
  } catch (error: unknown) {
    console.error(`API DELETE /api/assets/${assetId} error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al eliminar el activo" },
      { status: 500 }
    );
  }
}

// ==========================================
// 3. /api/assets/[id]/usage-logs
// ==========================================

const recordUsageLogBodySchema = z.object({
  metricType: z.enum(["ODOMETER_KM", "HOURS_OPERATED", "CYCLES", "CALENDAR_DAYS"]),
  value: z.union([z.string(), z.number()]),
  notes: z.string().nullable().optional(),
  allowMeterReplacement: z.boolean().optional(),
});

export async function handleGetUsageLogs(
  request: Request | NextRequest,
  assetId: string,
  deps?: AssetRouteAuthDeps
) {
  try {
    const authResult = await resolveAuthAndTenant("assets:read", deps);
    if (authResult.errorResponse) return authResult.errorResponse;

    const searchParams = new URL(request.url).searchParams;
    const pagination = CursorPaginationParamsSchema.parse({
      limit: searchParams.get("limit") || 10,
      cursor: searchParams.get("cursor") || undefined,
    });

    const metricType = searchParams.get("metricType") as AssetUsageMetricType | null;

    const result = await listUsageLogs({
      tenantId: authResult.tenantId,
      assetId,
      metricType: metricType || undefined,
      cursor: pagination.cursor,
      limit: pagination.limit,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error(`API GET /api/assets/${assetId}/usage-logs error:`, error);
    return NextResponse.json(
      { error: "Error al listar las bitácoras de uso" },
      { status: 500 }
    );
  }
}

export async function handlePostUsageLog(
  request: Request | NextRequest,
  assetId: string,
  deps?: AssetRouteAuthDeps
) {
  try {
    const authResult = await resolveAuthAndTenant("assets:write", deps);
    if (authResult.errorResponse) return authResult.errorResponse;

    const body = await request.json();
    const parsed = recordUsageLogBodySchema.parse(body);

    const log = await recordUsageLog({
      tenantId: authResult.tenantId,
      assetId,
      metricType: parsed.metricType,
      value: parsed.value,
      notes: parsed.notes,
      allowMeterReplacement: parsed.allowMeterReplacement,
      recordedBy: authResult.user.id,
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof InvalidTelemetryValueError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos de validación inválidos", details: error.errors },
        { status: 400 }
      );
    }
    console.error(`API POST /api/assets/${assetId}/usage-logs error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al registrar lectura de telemetría" },
      { status: 500 }
    );
  }
}

// ==========================================
// 4. /api/assets/[id]/orders
// ==========================================

const createOrderBodySchema = z.object({
  planId: z.string().nullable().optional(),
  orderType: z.enum(["PREVENTIVE", "CORRECTIVE"]),
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  cost: z.union([z.string(), z.number()]).optional(),
  currency: z.string().length(3).optional(),
  providerName: z.string().nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
  paymentTerms: z.enum(["IMMEDIATE", "CREDIT_15_DAYS", "CREDIT_30_DAYS", "CREDIT_60_DAYS"]).optional(),
  serviceDate: z.string().optional(),
  usageAtService: z.union([z.string(), z.number()]).nullable().optional(),
  partsReplaced: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().positive(),
        unitCost: z.number().min(0),
        partNumber: z.string().optional(),
      })
    )
    .optional(),
});

export async function handleGetOrders(
  request: Request | NextRequest,
  assetId: string,
  deps?: AssetRouteAuthDeps
) {
  try {
    const authResult = await resolveAuthAndTenant("assets:read", deps);
    if (authResult.errorResponse) return authResult.errorResponse;

    const searchParams = new URL(request.url).searchParams;
    const pagination = CursorPaginationParamsSchema.parse({
      limit: searchParams.get("limit") || 10,
      cursor: searchParams.get("cursor") || undefined,
    });

    const status = searchParams.get("status") as MaintenanceOrderStatus | null;

    const result = await listMaintenanceOrders({
      tenantId: authResult.tenantId,
      assetId,
      status: status || undefined,
      cursor: pagination.cursor,
      limit: pagination.limit,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error(`API GET /api/assets/${assetId}/orders error:`, error);
    return NextResponse.json(
      { error: "Error al listar las órdenes de mantenimiento" },
      { status: 500 }
    );
  }
}

export async function handlePostOrder(
  request: Request | NextRequest,
  assetId: string,
  deps?: AssetRouteAuthDeps
) {
  try {
    const authResult = await resolveAuthAndTenant("assets:write", deps);
    if (authResult.errorResponse) return authResult.errorResponse;

    const body = await request.json();
    const parsed = createOrderBodySchema.parse(body);

    const result = await createMaintenanceOrder({
      tenantId: authResult.tenantId,
      assetId,
      planId: parsed.planId,
      orderType: parsed.orderType as MaintenanceOrderType,
      title: parsed.title,
      description: parsed.description,
      cost: parsed.cost,
      currency: parsed.currency,
      providerName: parsed.providerName,
      invoiceNumber: parsed.invoiceNumber,
      paymentTerms: parsed.paymentTerms as MaintenancePaymentTerms | undefined,
      serviceDate: parsed.serviceDate,
      usageAtService: parsed.usageAtService,
      partsReplaced: parsed.partsReplaced,
      createdBy: authResult.user.id,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos de validación inválidos", details: error.errors },
        { status: 400 }
      );
    }
    console.error(`API POST /api/assets/${assetId}/orders error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al crear la orden de mantenimiento" },
      { status: 500 }
    );
  }
}

// ==========================================
// 5. /api/assets/[id]/orders/[orderId]
// ==========================================

const patchOrderBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("COMPLETE"),
    usageAtService: z.union([z.string(), z.number()]).nullable().optional(),
    partsReplaced: z
      .array(
        z.object({
          name: z.string().min(1),
          quantity: z.number().positive(),
          unitCost: z.number().min(0),
          partNumber: z.string().optional(),
        })
      )
      .optional(),
  }),
  z.object({
    action: z.literal("CANCEL"),
    reason: z.string().min(1, "Reason is required to cancel an order"),
  }),
]);

export async function handlePatchOrder(
  request: Request | NextRequest,
  assetId: string,
  orderId: string,
  deps?: AssetRouteAuthDeps
) {
  try {
    const authResult = await resolveAuthAndTenant("assets:write", deps);
    if (authResult.errorResponse) return authResult.errorResponse;

    const body = await request.json();
    const parsed = patchOrderBodySchema.parse(body);

    if (parsed.action === "CANCEL") {
      const result = await cancelMaintenanceOrder({
        tenantId: authResult.tenantId,
        orderId,
        reason: parsed.reason,
        userId: authResult.user.id,
      });
      return NextResponse.json(result);
    } else {
      const order = await completeMaintenanceOrder({
        tenantId: authResult.tenantId,
        orderId,
        usageAtService: parsed.usageAtService,
        partsReplaced: parsed.partsReplaced,
        userId: authResult.user.id,
      });
      return NextResponse.json({ order });
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos de validación inválidos", details: error.errors },
        { status: 400 }
      );
    }
    console.error(`API PATCH /api/assets/${assetId}/orders/${orderId} error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al actualizar el estado de la orden" },
      { status: 500 }
    );
  }
}
