export interface CursorData {
  createdAt: string;
  id: string;
}

export interface CursorPaginationParams {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
