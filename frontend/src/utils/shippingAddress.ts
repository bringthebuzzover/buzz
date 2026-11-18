export type ShippingAddressSnapshot = Record<string, unknown> | null | undefined;

export const SHIPPING_CHANGE_REASON_LENGTH = { min: 10, max: 1000 } as const;

export function formatShippingAddress(address: ShippingAddressSnapshot): string {
  if (!address) return "Address unavailable";
  const street = [address.shippingLine1, address.shippingLine2]
    .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
    .join(", ");
  const locality = [address.shippingCity, address.shippingState, address.shippingPostalCode]
    .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
    .join(", ");
  return [street, locality].filter(Boolean).join(" · ") || String(address.formatted ?? "Address unavailable");
}

export function shippingAddressLines(address: ShippingAddressSnapshot): string[] {
  if (!address) return [];
  const formatted = formatShippingAddress(address);
  return formatted === "Address unavailable" ? [] : formatted.split(" · ");
}
