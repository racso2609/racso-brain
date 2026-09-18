"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Plus, AlertCircle, Loader2 } from "lucide-react";
import type { AssetType, AssetStatus } from "@/core/assets/types";

export interface CreateAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateAssetModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateAssetModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AssetType>("VEHICLE");
  const [status, setStatus] = useState<AssetStatus>("OPERATIONAL");
  const [serialNumber, setSerialNumber] = useState("");

  // Custom polymorphic fields state
  const [customFields, setCustomFields] = useState<Record<string, any>>({
    brand: "",
    model: "",
    year: new Date().getFullYear(),
    fuelType: "DIESEL",
    vin: "",
    licensePlate: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleTypeChange = (newType: AssetType) => {
    setType(newType);
    setError(null);
    switch (newType) {
      case "VEHICLE":
        setCustomFields({
          brand: "",
          model: "",
          year: new Date().getFullYear(),
          fuelType: "DIESEL",
          vin: "",
          licensePlate: "",
        });
        break;
      case "HVAC":
        setCustomFields({
          btuCapacity: 24000,
          refrigerantType: "R-410A",
          locationZone: "",
          filterType: "",
        });
        break;
      case "HEAVY_MACHINERY":
        setCustomFields({
          engineModel: "",
          operatingWeightTons: 10,
          fuelCapacityLiters: 200,
        });
        break;
      case "EQUIPMENT":
        setCustomFields({
          manufacturer: "",
          powerVoltage: "220V",
          ratedPowerKw: 5,
        });
        break;
      case "FACILITY":
        setCustomFields({
          floorOrSector: "",
          squareMeters: 100,
          emergencyContact: "",
        });
        break;
    }
  };

  const updateCustomField = (key: string, value: any) => {
    setCustomFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("El nombre del activo es obligatorio.");
      return;
    }

    // Client-side quick validations according to polymorphic schemas
    if (type === "VEHICLE") {
      if (!customFields.brand?.trim() || !customFields.model?.trim()) {
        setError("Marca y modelo son obligatorios para vehículos.");
        return;
      }
    } else if (type === "HVAC") {
      if (!customFields.locationZone?.trim() || !customFields.refrigerantType?.trim()) {
        setError("Zona de ubicación y refrigerante son obligatorios para HVAC.");
        return;
      }
    } else if (type === "HEAVY_MACHINERY") {
      if (!customFields.engineModel?.trim()) {
        setError("El modelo del motor es obligatorio para maquinaria pesada.");
        return;
      }
    } else if (type === "EQUIPMENT") {
      if (!customFields.manufacturer?.trim()) {
        setError("El fabricante es obligatorio para equipos.");
        return;
      }
    } else if (type === "FACILITY") {
      if (!customFields.floorOrSector?.trim()) {
        setError("Piso o sector es obligatorio para instalaciones.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          status,
          serialNumber: serialNumber.trim() || null,
          customFields,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al registrar el activo");
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al registrar el activo");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="create-asset-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Registrar Nuevo Activo
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Crea un objeto mantenible con atributos específicos según su tipo.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            data-testid="asset-form-error"
            className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* General Fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Nombre del Activo *
              </label>
              <input
                type="text"
                data-testid="input-asset-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Camión Freightliner M2"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Tipo de Activo
                </label>
                <select
                  data-testid="select-asset-type"
                  value={type}
                  onChange={(e) => handleTypeChange(e.target.value as AssetType)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="VEHICLE">Vehículo</option>
                  <option value="HVAC">Climatización (HVAC)</option>
                  <option value="HEAVY_MACHINERY">Maquinaria Pesada</option>
                  <option value="EQUIPMENT">Equipo / Herramienta</option>
                  <option value="FACILITY">Instalación / Edificio</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Estado
                </label>
                <select
                  data-testid="select-asset-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AssetStatus)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="OPERATIONAL">Operativo</option>
                  <option value="UNDER_MAINTENANCE">En Mantenimiento</option>
                  <option value="DECOMMISSIONED">Dado de Baja</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Número de Serie / Placa / Identificador
              </label>
              <input
                type="text"
                data-testid="input-serial-number"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Ej. VIN, Serie o Matrícula"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Polymorphic Dynamic Fields */}
          <div className="pt-2 border-t border-border space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Campos Específicos: {type}
            </h4>

            {type === "VEHICLE" && (
              <div data-testid="fields-vehicle" className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Marca *
                    </label>
                    <input
                      type="text"
                      data-testid="input-vehicle-brand"
                      value={customFields.brand || ""}
                      onChange={(e) => updateCustomField("brand", e.target.value)}
                      placeholder="Ej. Isuzu"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Modelo *
                    </label>
                    <input
                      type="text"
                      data-testid="input-vehicle-model"
                      value={customFields.model || ""}
                      onChange={(e) => updateCustomField("model", e.target.value)}
                      placeholder="Ej. NPR"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Año *
                    </label>
                    <input
                      type="number"
                      data-testid="input-vehicle-year"
                      value={customFields.year || 2022}
                      onChange={(e) => updateCustomField("year", parseInt(e.target.value))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Combustible *
                    </label>
                    <select
                      data-testid="select-vehicle-fuel"
                      value={customFields.fuelType || "DIESEL"}
                      onChange={(e) => updateCustomField("fuelType", e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                    >
                      <option value="DIESEL">Diésel</option>
                      <option value="GASOLINE">Gasolina</option>
                      <option value="ELECTRIC">Eléctrico</option>
                      <option value="HYBRID">Híbrido</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {type === "HVAC" && (
              <div data-testid="fields-hvac" className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Capacidad BTU *
                    </label>
                    <input
                      type="number"
                      data-testid="input-hvac-btu"
                      value={customFields.btuCapacity || 24000}
                      onChange={(e) => updateCustomField("btuCapacity", parseFloat(e.target.value))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Refrigerante *
                    </label>
                    <input
                      type="text"
                      data-testid="input-hvac-refrigerant"
                      value={customFields.refrigerantType || "R-410A"}
                      onChange={(e) => updateCustomField("refrigerantType", e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Zona de Ubicación *
                  </label>
                  <input
                    type="text"
                    data-testid="input-hvac-zone"
                    value={customFields.locationZone || ""}
                    onChange={(e) => updateCustomField("locationZone", e.target.value)}
                    placeholder="Ej. Servidores Planta Baja"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                    required
                  />
                </div>
              </div>
            )}

            {type === "HEAVY_MACHINERY" && (
              <div data-testid="fields-heavy-machinery" className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Modelo del Motor *
                  </label>
                  <input
                    type="text"
                    data-testid="input-machinery-engine"
                    value={customFields.engineModel || ""}
                    onChange={(e) => updateCustomField("engineModel", e.target.value)}
                    placeholder="Ej. CAT C9.3 ACERT"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Peso Operativo (Ton)
                    </label>
                    <input
                      type="number"
                      value={customFields.operatingWeightTons || ""}
                      onChange={(e) => updateCustomField("operatingWeightTons", parseFloat(e.target.value))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Tanque Combustible (L)
                    </label>
                    <input
                      type="number"
                      value={customFields.fuelCapacityLiters || ""}
                      onChange={(e) => updateCustomField("fuelCapacityLiters", parseFloat(e.target.value))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                    />
                  </div>
                </div>
              </div>
            )}

            {type === "EQUIPMENT" && (
              <div data-testid="fields-equipment" className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Fabricante *
                  </label>
                  <input
                    type="text"
                    data-testid="input-equipment-manufacturer"
                    value={customFields.manufacturer || ""}
                    onChange={(e) => updateCustomField("manufacturer", e.target.value)}
                    placeholder="Ej. Bosch / DeWalt"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Voltaje
                    </label>
                    <input
                      type="text"
                      value={customFields.powerVoltage || "220V"}
                      onChange={(e) => updateCustomField("powerVoltage", e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Potencia (kW)
                    </label>
                    <input
                      type="number"
                      value={customFields.ratedPowerKw || ""}
                      onChange={(e) => updateCustomField("ratedPowerKw", parseFloat(e.target.value))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                    />
                  </div>
                </div>
              </div>
            )}

            {type === "FACILITY" && (
              <div data-testid="fields-facility" className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Piso o Sector *
                  </label>
                  <input
                    type="text"
                    data-testid="input-facility-sector"
                    value={customFields.floorOrSector || ""}
                    onChange={(e) => updateCustomField("floorOrSector", e.target.value)}
                    placeholder="Ej. Edificio B - Nivel 3"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Superficie (m²)
                    </label>
                    <input
                      type="number"
                      value={customFields.squareMeters || ""}
                      onChange={(e) => updateCustomField("squareMeters", parseFloat(e.target.value))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Contacto Emergencia
                    </label>
                    <input
                      type="text"
                      value={customFields.emergencyContact || ""}
                      onChange={(e) => updateCustomField("emergencyContact", e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              data-testid="button-submit-asset"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Guardar Activo
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
