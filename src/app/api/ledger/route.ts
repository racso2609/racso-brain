import { type NextRequest } from "next/server";
import { handleGetLedger } from "@/core/ledger/handler";

export async function GET(request: NextRequest) {
  return handleGetLedger(request);
}
