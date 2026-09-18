import { type NextRequest } from "next/server";
import { handlePatchPlan } from "@/core/assets/handlers";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const { id, planId } = await params;
  return handlePatchPlan(request, id, planId);
}
