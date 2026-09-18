import React from "react";
import { AssetDetailView } from "@/components/assets/asset-detail-view";

export const metadata = {
  title: "Ficha Técnica del Activo | racso-brain",
  description: "Detalle técnico, semáforo preventivo, telemetría y órdenes de mantenimiento.",
};

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <AssetDetailView assetId={id} />
    </div>
  );
}
