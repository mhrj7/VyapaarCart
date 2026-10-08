import { normalizeProductAttributes, type ProductAttribute } from "./product-attributes";

export type ProductVariantInput = { name: string; sku: string; price: number; attributes: ProductAttribute[] };

export function normalizeProductVariants(input: unknown): ProductVariantInput[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > 20) return null;
  const skus = new Set<string>();
  const variants: ProductVariantInput[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const candidate = item as { name?: unknown; sku?: unknown; price?: unknown; attributes?: unknown };
    const name = typeof candidate.name === "string" ? candidate.name.trim().slice(0, 80) : "";
    const sku = typeof candidate.sku === "string" ? candidate.sku.trim().toUpperCase().slice(0, 64) : "";
    const price = Number(candidate.price);
    const attributes = normalizeProductAttributes(candidate.attributes);
    if (!name || !/^[A-Z0-9][A-Z0-9._-]*$/.test(sku) || !Number.isSafeInteger(price) || price < 1 || attributes === null || skus.has(sku)) return null;
    skus.add(sku);
    variants.push({ name, sku, price, attributes });
  }
  return variants;
}
