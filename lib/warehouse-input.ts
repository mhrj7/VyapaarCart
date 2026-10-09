export function warehouseInput(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const text = (key: string, max: number) => typeof v[key] === "string" && v[key].trim().length <= max ? v[key].trim() : "";
  const result = { name: text("name", 80), address: text("address", 240), city: text("city", 80), postcode: text("postcode", 6) };
  return result.name && result.address && result.city && /^\d{6}$/.test(result.postcode) ? result : null;
}

export function stockInput(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  return typeof v.variantId === "string" && v.variantId.length > 0 && v.variantId.length <= 100 &&
    Number.isSafeInteger(v.quantity) && Number(v.quantity) >= 0 && Number(v.quantity) <= 1000000 &&
    Number.isSafeInteger(v.version) && Number(v.version) >= 0 && Number(v.version) < 2147483647
    ? { variantId: v.variantId, quantity: Number(v.quantity), version: Number(v.version) } : null;
}
