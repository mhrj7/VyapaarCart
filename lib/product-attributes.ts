export type ProductAttribute = { key: string; value: string };

export function normalizeProductAttributes(input: unknown): ProductAttribute[] | null {
  if (!Array.isArray(input) || input.length > 12) return null;
  const seen = new Set<string>();
  const attributes: ProductAttribute[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const candidate = item as { key?: unknown; value?: unknown };
    const key = typeof candidate.key === "string" ? candidate.key.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 40) : "";
    const value = typeof candidate.value === "string" ? candidate.value.trim().slice(0, 120) : "";
    if (!key || !/^[a-z][a-z0-9_]*$/.test(key) || !value || seen.has(key)) return null;
    seen.add(key);
    attributes.push({ key, value });
  }
  return attributes;
}

export function parseAttributeText(value: string): ProductAttribute[] | null {
  const trimmed = value.trim();
  if (!trimmed) return [];
  return normalizeProductAttributes(trimmed.split(",").map((part) => {
    const [key, ...rest] = part.split("=");
    return { key, value: rest.join("=") };
  }));
}
