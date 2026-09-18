import { type NextRequest } from "next/server";
import { handleGetUsageLogs, handlePostUsageLog } from "@/core/assets/handlers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleGetUsageLogs(request, id);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handlePostUsageLog(request, id);
}
