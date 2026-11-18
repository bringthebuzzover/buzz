export type Shipment = {
  id: string;
  trackingNumber: string;
  carrier: string;
  trackUrl: string | null;
  shippingAddressSnapshot?: {
    shippingLine1?: string | null;
    shippingLine2?: string | null;
    shippingCity?: string | null;
    shippingState?: string | null;
    shippingPostalCode?: string | null;
    formatted?: string | null;
  } | null;
  shippingAddressCapturedAt?: number | null;
};

export function shipmentDestination(shipment: Shipment): string {
  const snapshot = shipment.shippingAddressSnapshot;
  if (!snapshot) return "Destination unknown";
  if (snapshot.formatted) return snapshot.formatted;
  return [
    [snapshot.shippingLine1, snapshot.shippingLine2].filter(Boolean).join(", "),
    [snapshot.shippingCity, snapshot.shippingState].filter(Boolean).join(", "),
    snapshot.shippingPostalCode,
  ].filter(Boolean).join(", ") || "Destination unknown";
}

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

export function mergeShipment(list: Shipment[], next: Shipment): Shipment[] {
  return list.some((row) => row.id === next.id) ? list : [...list, next];
}

export function omitShipment(list: Shipment[], shipmentId: string): Shipment[] {
  return list.filter((row) => row.id !== shipmentId);
}
