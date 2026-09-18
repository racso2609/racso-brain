import { describe, it, expect } from "vitest";
import {
  evaluatePlanHealth,
  evaluateAssetMaintenanceHealth,
  validateOrderStateTransition,
  InvalidOrderStateTransitionError,
  type MaintenanceHealthStatus,
} from "@/core/assets/maintenance-rules";

describe("Maintenance Rules, Health Semaphores & Order Transitions (Task 2 TDD)", () => {
  describe("evaluatePlanHealth & evaluateAssetMaintenanceHealth", () => {
    const mockAsset = {
      id: "asset-1",
      tenantId: "tenant-1",
      name: "Camión Cisterna 01",
      type: "HEAVY_MACHINERY" as const,
      status: "OPERATIONAL" as const,
      createdAt: new Date("2026-01-01"),
    };

    const mockPlanUsage = {
      id: "plan-usage",
      tenantId: "tenant-1",
      assetId: "asset-1",
      assetType: null,
      name: "Cambio de Filtro de Aire",
      metricType: "HOURS_OPERATED" as const,
      intervalValue: "250.00",
      intervalDays: null,
      alertThresholdPercentage: 90,
      isActive: true,
    };

    const mockPlanDays = {
      id: "plan-days",
      tenantId: "tenant-1",
      assetId: "asset-1",
      assetType: null,
      name: "Inspección Semestral",
      metricType: "CALENDAR_DAYS" as const,
      intervalValue: null,
      intervalDays: 180,
      alertThresholdPercentage: 90,
      isActive: true,
    };

    it("evaluates plan as OK when usage < 90%", () => {
      // Last service at 1000 hours, current reading 1100 hours -> delta = 100 / 250 = 40%
      const health = evaluatePlanHealth({
        plan: mockPlanUsage,
        currentUsage: 1100,
        lastServiceUsage: 1000,
        currentDate: new Date("2026-09-17"),
        lastServiceDate: new Date("2026-09-01"),
      });

      expect(health.status).toBe("OK");
      expect(health.usagePercentage).toBe(40);
      expect(health.timePercentage).toBeNull();
    });

    it("evaluates plan as DUE_SOON when usage is between 90% and 100%", () => {
      // Last service at 1000 hours, current reading 1230 hours -> delta = 230 / 250 = 92%
      const health = evaluatePlanHealth({
        plan: mockPlanUsage,
        currentUsage: 1230,
        lastServiceUsage: 1000,
        currentDate: new Date("2026-09-17"),
        lastServiceDate: new Date("2026-09-01"),
      });

      expect(health.status).toBe("DUE_SOON");
      expect(health.usagePercentage).toBe(92);
    });

    it("evaluates plan as OVERDUE when usage >= 100%", () => {
      // Last service at 1000 hours, current reading 1255 hours -> delta = 255 / 250 = 102%
      const health = evaluatePlanHealth({
        plan: mockPlanUsage,
        currentUsage: 1255,
        lastServiceUsage: 1000,
        currentDate: new Date("2026-09-17"),
        lastServiceDate: new Date("2026-09-01"),
      });

      expect(health.status).toBe("OVERDUE");
      expect(health.usagePercentage).toBe(102);
    });

    it("evaluates dual thresholds (metric + calendar days) taking max percentage", () => {
      const dualPlan = {
        ...mockPlanUsage,
        intervalDays: 100,
      };

      // Usage is 50%, but days elapsed is 95 days / 100 = 95% -> DUE_SOON
      const health = evaluatePlanHealth({
        plan: dualPlan,
        currentUsage: 1125,
        lastServiceUsage: 1000,
        currentDate: new Date("2026-09-17"),
        lastServiceDate: new Date("2026-06-14"), // 95 days ago
      });

      expect(health.status).toBe("DUE_SOON");
      expect(health.usagePercentage).toBe(50);
      expect(health.timePercentage).toBe(95);
      expect(health.dominantMetric).toBe("CALENDAR_DAYS");
    });

    it("computes worst status for asset across all plans in evaluateAssetMaintenanceHealth", () => {
      const overallHealth = evaluateAssetMaintenanceHealth({
        asset: mockAsset,
        plans: [mockPlanUsage, mockPlanDays],
        latestUsageLog: {
          metricType: "HOURS_OPERATED",
          value: "1255.00",
          recordedAt: new Date("2026-09-17"),
        },
        lastCompletedOrders: [
          {
            planId: "plan-usage",
            usageAtService: "1000.00",
            serviceDate: "2026-08-01",
          },
          {
            planId: "plan-days",
            usageAtService: null,
            serviceDate: "2026-08-01", // ~47 days ago -> OK
          },
        ],
        currentDate: new Date("2026-09-17"),
      });

      // plan-usage is OVERDUE, plan-days is OK -> overall is OVERDUE
      expect(overallHealth.overallStatus).toBe("OVERDUE");
      expect(overallHealth.planResults).toHaveLength(2);
    });
  });

  describe("validateOrderStateTransition", () => {
    it("allows valid transitions", () => {
      expect(validateOrderStateTransition("SCHEDULED", "IN_PROGRESS")).toBe(true);
      expect(validateOrderStateTransition("SCHEDULED", "CANCELLED")).toBe(true);
      expect(validateOrderStateTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
      expect(validateOrderStateTransition("IN_PROGRESS", "CANCELLED")).toBe(true);
    });

    it("rejects illegal transitions", () => {
      expect(() => validateOrderStateTransition("COMPLETED", "IN_PROGRESS")).toThrow(
        InvalidOrderStateTransitionError
      );
      expect(() => validateOrderStateTransition("COMPLETED", "CANCELLED")).toThrow(
        InvalidOrderStateTransitionError
      );
      expect(() => validateOrderStateTransition("CANCELLED", "SCHEDULED")).toThrow(
        InvalidOrderStateTransitionError
      );
      expect(() => validateOrderStateTransition("SCHEDULED", "COMPLETED")).toThrow(
        InvalidOrderStateTransitionError
      );
    });
  });
});
