export type Shipment = {
  id: string;
  trackingNumber: string;
  carrier: string;
  trackUrl: string | null;
};

export function carrierLabel(carrier: string): string {
  if (carrier === "ups") return "UPS";
  if (carrier === "fedex") return "FedEx";
  return "Unknown";
}

export function shipmentSummary(shipments: Shipment[] | undefined): string | null {
  const list = shipments ?? [];
  if (list.length === 0) return null;
  if (list.length === 1) return `#${list[0].trackingNumber}`;
  return `${list.length} tracking numbers`;
}
