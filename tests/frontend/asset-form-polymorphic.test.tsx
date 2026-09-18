import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { CreateAssetModal } from "@/components/assets/create-asset-modal";

describe("CreateAssetModal Polymorphic Form (TC-FE-ASSETS-03, TC-FE-ASSETS-04)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders VEHICLE dynamic fields by default and switches to HVAC dynamic fields", () => {
    render(<CreateAssetModal isOpen={true} onClose={vi.fn()} />);

    // VEHICLE fields should be visible initially
    expect(screen.getByTestId("fields-vehicle")).toBeInTheDocument();
    expect(screen.getByTestId("input-vehicle-brand")).toBeInTheDocument();
    expect(screen.getByTestId("input-vehicle-model")).toBeInTheDocument();
    expect(screen.queryByTestId("fields-hvac")).not.toBeInTheDocument();

    // Switch type to HVAC
    const typeSelect = screen.getByTestId("select-asset-type");
    fireEvent.change(typeSelect, { target: { value: "HVAC" } });

    // HVAC fields should now be visible and VEHICLE fields gone
    expect(screen.getByTestId("fields-hvac")).toBeInTheDocument();
    expect(screen.getByTestId("input-hvac-btu")).toBeInTheDocument();
    expect(screen.getByTestId("input-hvac-zone")).toBeInTheDocument();
    expect(screen.queryByTestId("fields-vehicle")).not.toBeInTheDocument();
  });

  it("validates required vehicle fields and displays validation error", async () => {
    render(<CreateAssetModal isOpen={true} onClose={vi.fn()} />);

    // Enter asset name but leave brand/model empty
    const nameInput = screen.getByTestId("input-asset-name");
    fireEvent.change(nameInput, { target: { value: "Camión Reparto 01" } });

    const submitBtn = screen.getByTestId("button-submit-asset");
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/marca y modelo son obligatorios para vehículos/i)
    ).toBeInTheDocument();
  });

  it("submits valid vehicle payload to /api/assets", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "asset-123", name: "Camión Reparto 01" }),
    });
    global.fetch = fetchMock;

    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      <CreateAssetModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    // Fill common and vehicle fields
    fireEvent.change(screen.getByTestId("input-asset-name"), {
      target: { value: "Camión Reparto 01" },
    });
    fireEvent.change(screen.getByTestId("input-vehicle-brand"), {
      target: { value: "Isuzu" },
    });
    fireEvent.change(screen.getByTestId("input-vehicle-model"), {
      target: { value: "Forward 800" },
    });

    fireEvent.click(screen.getByTestId("button-submit-asset"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/assets",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining('"brand":"Isuzu"'),
        })
      );
    });

    expect(handleSuccess).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });
});
