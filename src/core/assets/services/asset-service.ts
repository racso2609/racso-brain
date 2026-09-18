import { db } from "@/db";
import {
  assets,
  insertAssetSchema,
  type Asset,
} from "@/db/schema/assets";
import {
  validateAssetCustomFields,
  type AssetType,
  type AssetStatus,
} from "@/core/assets/types";
import { eq, and, or, lt, desc, ilike } from "drizzle-orm";
import { encodeCursor, decodeCursor } from "@/lib/pagination/cursor";
import type { PaginatedResult } from "@/lib/pagination/types";
import { recordAuditLog } from "@/core/audit/service";

export interface CreateAssetInput {
  tenantId: string;
  name: string;
  type: AssetType;
  status?: AssetStatus;
  serialNumber?: string | null;
  customFields?: Record<string, unknown>;
  createdBy?: string | null;
}

export async function createAsset(input: CreateAssetInput): Promise<Asset> {
  const validatedCustomFields = validateAssetCustomFields(
    input.type,
    input.customFields ?? {}
  );

  const validated = insertAssetSchema.parse({
    tenantId: input.tenantId,
    name: input.name,
    type: input.type,
    status: input.status ?? "OPERATIONAL",
    serialNumber: input.serialNumber ?? null,
    customFields: validatedCustomFields,
    createdBy: input.createdBy ?? null,
  });

  const [inserted] = await db.insert(assets).values(validated).returning();

  await recordAuditLog({
    tenantId: inserted.tenantId,
    userId: inserted.createdBy,
    action: "CREATE_ASSET",
    entityType: "asset",
    entityId: inserted.id,
    newData: inserted as unknown as Record<string, unknown>,
  });

  return inserted;
}

export async function getAssetById(
  tenantId: string,
  assetId: string
): Promise<Asset | null> {
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.tenantId, tenantId)));

  return asset ?? null;
}

export interface ListAssetsParams {
  tenantId: string;
  type?: AssetType;
  status?: AssetStatus;
  search?: string;
  cursor?: string;
  limit?: number;
}

export async function listAssets(
  params: ListAssetsParams
): Promise<PaginatedResult<Asset>> {
  const limit = params.limit ?? 10;
  const conditions = [eq(assets.tenantId, params.tenantId)];

  if (params.type) {
    conditions.push(eq(assets.type, params.type));
  }

  if (params.status) {
    conditions.push(eq(assets.status, params.status));
  }

  if (params.search && params.search.trim()) {
    conditions.push(ilike(assets.name, `%${params.search.trim()}%`));
  }

  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded) {
      const cursorDate = new Date(decoded.createdAt);
      conditions.push(
        or(
          lt(assets.createdAt, cursorDate),
          and(eq(assets.createdAt, cursorDate), lt(assets.id, decoded.id))
        )!
      );
    }
  }

  const rows = await db
    .select()
    .from(assets)
    .where(and(...conditions))
    .orderBy(desc(assets.createdAt), desc(assets.id))
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

export interface UpdateAssetInput {
  tenantId: string;
  assetId: string;
  name?: string;
  status?: AssetStatus;
  serialNumber?: string | null;
  customFields?: Record<string, unknown>;
  userId?: string | null;
}

export async function updateAsset(input: UpdateAssetInput): Promise<Asset> {
  const existing = await getAssetById(input.tenantId, input.assetId);
  if (!existing) {
    throw new Error(`Asset ${input.assetId} not found in this tenant`);
  }

  let finalCustomFields = existing.customFields as Record<string, unknown>;
  if (input.customFields) {
    const merged = { ...finalCustomFields, ...input.customFields };
    finalCustomFields = validateAssetCustomFields(existing.type as AssetType, merged);
  }

  const [updated] = await db
    .update(assets)
    .set({
      name: input.name ?? existing.name,
      status: input.status ?? existing.status,
      serialNumber: input.serialNumber !== undefined ? input.serialNumber : existing.serialNumber,
      customFields: finalCustomFields,
      updatedAt: new Date(),
    })
    .where(and(eq(assets.id, input.assetId), eq(assets.tenantId, input.tenantId)))
    .returning();

  await recordAuditLog({
    tenantId: input.tenantId,
    userId: input.userId,
    action: "UPDATE_ASSET",
    entityType: "asset",
    entityId: updated.id,
    oldData: existing as unknown as Record<string, unknown>,
    newData: updated as unknown as Record<string, unknown>,
  });

  return updated;
}
