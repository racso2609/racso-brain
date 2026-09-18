import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { PermissionGate } from "@/components/shared/permission-gate";

describe("PermissionGate RBAC Client Guard (TC-FE-06, TC-FE-07)", () => {
  it("TC-FE-07: renders protected children when user role possesses the required permission", () => {
    render(
      <PermissionGate userRole="OWNER" requiredPermission="ledger:write">
        <button>Registrar Movimiento</button>
      </PermissionGate>
    );

    expect(screen.getByRole("button", { name: /registrar movimiento/i })).toBeInTheDocument();
  });

  it("TC-FE-06: hides protected children when user role lacks required permission", () => {
    render(
      <PermissionGate userRole="MAINTENANCE_OPERATOR" requiredPermission="ledger:write">
        <button>Registrar Movimiento</button>
      </PermissionGate>
    );

    expect(screen.queryByRole("button", { name: /registrar movimiento/i })).not.toBeInTheDocument();
  });

  it("renders fallback content when provided and permission is denied", () => {
    render(
      <PermissionGate
        userRole="MEMBER"
        requiredPermission="ledger:write"
        fallback={<p>Acceso denegado</p>}
      >
        <button>Registrar Movimiento</button>
      </PermissionGate>
    );

    expect(screen.queryByRole("button", { name: /registrar movimiento/i })).not.toBeInTheDocument();
    expect(screen.getByText(/acceso denegado/i)).toBeInTheDocument();
  });
});
