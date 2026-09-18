import React from "react";
import { AssetCatalog } from "@/components/assets/asset-catalog";

export const metadata = {
  title: "Catálogo de Activos | racso-brain",
  description: "Registro y gestión técnica de activos físicos y objetos mantenibles.",
};

export default function AssetsPage() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <AssetCatalog />
    </div>
  );
}
