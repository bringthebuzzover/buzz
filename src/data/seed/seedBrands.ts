/**
 * Seed brands referenced by drops. Brands themselves don't need their own store in v1
 * (only id + display name are read), so this file just exposes the constants.
 */

export type SeedBrand = {
  id: string;
  name: string;
};

/** Demo persona's brand id (the one a brand demo user "is"). */
export const DEMO_BRAND_ID = "brand-poppi";

export const SEED_BRANDS: SeedBrand[] = [
  { id: DEMO_BRAND_ID, name: "Poppi" },
  { id: "brand-summer-fridays", name: "Summer Fridays" },
  { id: "brand-rare-beauty", name: "Rare Beauty" },
  { id: "brand-yerba-mate", name: "Yerba Madre" },
];
