import { type NextRequest } from "next/server";
import { handleGetAssets, handlePostAssets } from "@/core/assets/handlers";

export async function GET(request: NextRequest) {
  return handleGetAssets(request);
}

export async function POST(request: NextRequest) {
  return handlePostAssets(request);
}
