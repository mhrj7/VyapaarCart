export const maxProductImageBytes = 5 * 1024 * 1024;

/** Validate the file signature as well as the browser-supplied MIME type. */
export function productImageExtension(bytes: Uint8Array, contentType: string) {
  if (!bytes.length || bytes.length > maxProductImageBytes) return null;
  if (contentType === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (contentType === "image/png" && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "png";
  if (contentType === "image/webp" && Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP") return "webp";
  return null;
}

export function isCompleteImageOrder(input: unknown, currentIds: string[]): input is string[] {
  return Array.isArray(input) && input.length === currentIds.length && new Set(input).size === input.length && input.every((id) => typeof id === "string" && currentIds.includes(id));
}
