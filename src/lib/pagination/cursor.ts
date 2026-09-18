import { z } from "zod";
import type { CursorData } from "./types";

export const CursorPaginationParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  cursor: z.string().optional(),
});

export function encodeCursor(data: { createdAt: Date | string; id: string }): string {
  const createdAtStr =
    data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt;

  const payload: CursorData = {
    createdAt: createdAtStr,
    id: data.id,
  };

  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeCursor(cursor: string): CursorData | null {
  if (!cursor || typeof cursor !== "string") {
    return null;
  }

  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf-8");
    const parsed = JSON.parse(raw);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.createdAt === "string" &&
      typeof parsed.id === "string"
    ) {
      return {
        createdAt: parsed.createdAt,
        id: parsed.id,
      };
    }
    return null;
  } catch {
    return null;
  }
}
