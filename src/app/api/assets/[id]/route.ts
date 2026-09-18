import { type NextRequest } from "next/server";
import {
  handleGetAssetDetail,
  handlePatchAsset,
  handleDeleteAsset,
} from "@/core/assets/handlers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleGetAssetDetail(request, id);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handlePatchAsset(request, id);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleDeleteAsset(request, id);
}
