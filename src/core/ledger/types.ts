import type { FinancialTxType, FinancialTxStatus } from "@/db/schema/ledger";

export class InvalidStateTransitionError extends Error {
  public statusCode = 400;
  constructor(current: string, target: string) {
    super(`Cannot transition financial transaction from state '${current}' to '${target}'`);
    this.name = "InvalidStateTransitionError";
  }
}

export const ALLOWED_TRANSITIONS: Record<FinancialTxStatus, readonly FinancialTxStatus[]> = {
  COMMITTED: ["VOIDED"],
  PENDING_PAYMENT: ["SETTLED", "VOIDED"],
  SETTLED: [],
  VOIDED: [],
};

export function validateStateTransition(
  current: FinancialTxStatus,
  target: FinancialTxStatus
): boolean {
  if (current === target) {
    return true;
  }
  const allowed = ALLOWED_TRANSITIONS[current] || [];
  if (!allowed.includes(target)) {
    throw new InvalidStateTransitionError(current, target);
  }
  return true;
}

export interface CreateTransactionParams {
  tenantId: string;
  txType: FinancialTxType;
  status?: FinancialTxStatus;
  amount: string;
  currency?: string;
  issueDate?: string;
  dueDate?: string | null;
  originModule: string;
  originId?: string | null;
  category: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
}
