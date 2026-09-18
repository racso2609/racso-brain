import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { TenantSwitcher } from "@/components/shared/tenant-switcher";

describe("TenantSwitcher Component (TC-FE-04, TC-FE-05)", () => {
  const mockTenants = [
    { id: "t-1", name: "Espacio Personal de Oscar", role: "OWNER" },
    { id: "t-2", name: "Empresa de Ingeniería", role: "ADMIN" },
  ];

  it("TC-FE-04: renders active workspace name and shows options upon interaction", () => {
    render(
      <TenantSwitcher
        activeTenantId="t-1"
        tenants={mockTenants}
        onSwitchTenant={vi.fn()}
      />
    );

    // Initial button displays active tenant name
    expect(screen.getByText("Espacio Personal de Oscar")).toBeInTheDocument();

    // Click trigger to open menu
    const trigger = screen.getByRole("button", { name: /espacio personal de oscar/i });
    fireEvent.click(trigger);

    // Both tenants should now be visible in list
    expect(screen.getByText("Empresa de Ingeniería")).toBeInTheDocument();
  });

  it("TC-FE-05: triggers onSwitchTenant callback when another tenant is selected", () => {
    const handleSwitch = vi.fn();

    render(
      <TenantSwitcher
        activeTenantId="t-1"
        tenants={mockTenants}
        onSwitchTenant={handleSwitch}
      />
    );

    const trigger = screen.getByRole("button", { name: /espacio personal de oscar/i });
    fireEvent.click(trigger);

    const option = screen.getByText("Empresa de Ingeniería");
    fireEvent.click(option);

    expect(handleSwitch).toHaveBeenCalledWith("t-2");
  });
});
