import type {
  MaintenanceOrderStatus,
  AssetUsageMetricType,
} from "./types";

export type MaintenanceHealthStatus = "OK" | "DUE_SOON" | "OVERDUE";

export class InvalidOrderStateTransitionError extends Error {
  constructor(currentStatus: string, targetStatus: string) {
    super(
      `Invalid maintenance order transition from ${currentStatus} to ${targetStatus}`
    );
    this.name = "InvalidOrderStateTransitionError";
  }
}

const ALLOWED_ORDER_TRANSITIONS: Record<
  MaintenanceOrderStatus,
  readonly MaintenanceOrderStatus[]
> = {
  SCHEDULED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function validateOrderStateTransition(
  currentStatus: MaintenanceOrderStatus,
  targetStatus: MaintenanceOrderStatus
): boolean {
  const allowed = ALLOWED_ORDER_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(targetStatus)) {
    throw new InvalidOrderStateTransitionError(currentStatus, targetStatus);
  }
  return true;
}

export interface PlanLike {
  id: string;
  name: string;
  metricType: AssetUsageMetricType;
  intervalValue?: string | number | null;
  intervalDays?: number | null;
  alertThresholdPercentage?: number | null;
  isActive?: boolean;
  baselineUsage?: string | number | null;
  baselineDate?: string | Date | null;
}

export interface PlanHealthResult {
  planId: string;
  planName: string;
  status: MaintenanceHealthStatus;
  usagePercentage: number | null;
  timePercentage: number | null;
  maxPercentage: number;
  dominantMetric: "USAGE" | "CALENDAR_DAYS";
}

export function evaluatePlanHealth(params: {
  plan: PlanLike;
  currentUsage?: number | null;
  lastServiceUsage?: number | null;
  currentDate?: Date;
  lastServiceDate?: Date | string | null;
}): PlanHealthResult {
  const { plan, currentUsage, lastServiceUsage, currentDate = new Date(), lastServiceDate } = params;
  const threshold = plan.alertThresholdPercentage ?? 90;

  let usagePercentage: number | null = null;
  if (plan.intervalValue !== null && plan.intervalValue !== undefined) {
    const interval = typeof plan.intervalValue === "string" ? parseFloat(plan.intervalValue) : plan.intervalValue;
    if (interval > 0 && currentUsage !== null && currentUsage !== undefined) {
      const baseUsage = lastServiceUsage ?? 0;
      const deltaUsage = Math.max(0, currentUsage - baseUsage);
      usagePercentage = Math.round((deltaUsage / interval) * 100 * 10) / 10;
    }
  }

  let timePercentage: number | null = null;
  if (plan.intervalDays && plan.intervalDays > 0 && lastServiceDate) {
    const lastDate = typeof lastServiceDate === "string" ? new Date(lastServiceDate) : lastServiceDate;
    const diffMs = currentDate.getTime() - lastDate.getTime();
    const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    timePercentage = Math.round((diffDays / plan.intervalDays) * 100 * 10) / 10;
  }

  const effectiveUsagePct = usagePercentage ?? 0;
  const effectiveTimePct = timePercentage ?? 0;
  const maxPercentage = Math.max(effectiveUsagePct, effectiveTimePct);

  let status: MaintenanceHealthStatus = "OK";
  if (maxPercentage >= 100) {
    status = "OVERDUE";
  } else if (maxPercentage >= threshold) {
    status = "DUE_SOON";
  }

  const dominantMetric: "USAGE" | "CALENDAR_DAYS" =
    effectiveTimePct > effectiveUsagePct ? "CALENDAR_DAYS" : "USAGE";

  return {
    planId: plan.id,
    planName: plan.name,
    status,
    usagePercentage,
    timePercentage,
    maxPercentage,
    dominantMetric,
  };
}

export interface AssetLike {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt?: Date | string;
}

export interface CompletedOrderLike {
  planId?: string | null;
  usageAtService?: string | number | null;
  serviceDate: string | Date;
}

export interface UsageLogLike {
  metricType: AssetUsageMetricType;
  value: string | number;
  recordedAt: Date | string;
}

export interface AssetOverallHealthResult {
  overallStatus: MaintenanceHealthStatus;
  planResults: PlanHealthResult[];
}

export function evaluateAssetMaintenanceHealth(params: {
  asset: AssetLike;
  plans: PlanLike[];
  latestUsageLog?: UsageLogLike | null;
  lastCompletedOrders?: CompletedOrderLike[];
  currentDate?: Date;
}): AssetOverallHealthResult {
  const { plans, latestUsageLog, lastCompletedOrders = [], currentDate = new Date() } = params;

  const activePlans = plans.filter((p) => p.isActive !== false);

  if (activePlans.length === 0) {
    return {
      overallStatus: "OK",
      planResults: [],
    };
  }

  const currentUsageVal = latestUsageLog
    ? typeof latestUsageLog.value === "string"
      ? parseFloat(latestUsageLog.value)
      : latestUsageLog.value
    : null;

  const planResults: PlanHealthResult[] = activePlans.map((plan) => {
    // Find the latest completed order for this plan
    const matchingOrders = lastCompletedOrders
      .filter((o) => o.planId === plan.id)
      .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());

    const lastOrder = matchingOrders[0];
    const lastUsage = lastOrder?.usageAtService
      ? typeof lastOrder.usageAtService === "string"
        ? parseFloat(lastOrder.usageAtService)
        : lastOrder.usageAtService
      : plan.baselineUsage
        ? typeof plan.baselineUsage === "string"
          ? parseFloat(plan.baselineUsage)
          : plan.baselineUsage
        : null;

    const lastServiceDate = lastOrder?.serviceDate ?? plan.baselineDate ?? null;

    return evaluatePlanHealth({
      plan,
      currentUsage: currentUsageVal,
      lastServiceUsage: lastUsage,
      currentDate,
      lastServiceDate,
    });
  });

  // Calculate overallStatus: OVERDUE > DUE_SOON > OK
  let overallStatus: MaintenanceHealthStatus = "OK";
  if (planResults.some((r) => r.status === "OVERDUE")) {
    overallStatus = "OVERDUE";
  } else if (planResults.some((r) => r.status === "DUE_SOON")) {
    overallStatus = "DUE_SOON";
  }

  return {
    overallStatus,
    planResults,
  };
}
