import { type NextRequest } from "next/server";
import { handlePatchOrder } from "@/core/assets/handlers";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  const { id, orderId } = await params;
  return handlePatchOrder(request, id, orderId);
}
