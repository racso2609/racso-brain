import { describe, it, expect } from "vitest";
import {
  encodeCursor,
  decodeCursor,
  CursorPaginationParamsSchema,
} from "@/lib/pagination/cursor";

describe("Cursor-Based Pagination", () => {
  it("encodes and decodes a cursor object correctly", () => {
    const timestamp = "2026-09-17T12:00:00.000Z";
    const id = "e87b7a70-8bf1-4bb5-8664-df8398e09f6b";

    const cursor = encodeCursor({ createdAt: timestamp, id });
    expect(typeof cursor).toBe("string");
    expect(cursor.length).toBeGreaterThan(0);

    const decoded = decodeCursor(cursor);
    expect(decoded).not.toBeNull();
    expect(decoded?.createdAt).toBe(timestamp);
    expect(decoded?.id).toBe(id);
  });

  it("handles Date objects when encoding cursor", () => {
    const date = new Date("2026-09-17T12:00:00.000Z");
    const id = "e87b7a70-8bf1-4bb5-8664-df8398e09f6b";

    const cursor = encodeCursor({ createdAt: date, id });
    const decoded = decodeCursor(cursor);

    expect(decoded?.createdAt).toBe(date.toISOString());
    expect(decoded?.id).toBe(id);
  });

  it("returns null for malformed or invalid cursors", () => {
    expect(decodeCursor("invalid-base64!!")).toBeNull();
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor(Buffer.from("not-json").toString("base64"))).toBeNull();
    expect(
      decodeCursor(Buffer.from(JSON.stringify({ onlyId: "123" })).toString("base64"))
    ).toBeNull();
  });

  it("validates pagination parameters via Zod schema", () => {
    // Default limit
    const parsedDefault = CursorPaginationParamsSchema.parse({});
    expect(parsedDefault.limit).toBe(10);
    expect(parsedDefault.cursor).toBeUndefined();

    // Explicit valid params
    const parsedCustom = CursorPaginationParamsSchema.parse({
      limit: 25,
      cursor: "valid-cursor-string",
    });
    expect(parsedCustom.limit).toBe(25);
    expect(parsedCustom.cursor).toBe("valid-cursor-string");

    // Rejects out of bound limits
    expect(() => CursorPaginationParamsSchema.parse({ limit: 0 })).toThrow();
    expect(() => CursorPaginationParamsSchema.parse({ limit: 101 })).toThrow();
    expect(() => CursorPaginationParamsSchema.parse({ limit: -5 })).toThrow();
  });
});
