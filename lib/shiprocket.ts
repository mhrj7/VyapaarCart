const sandboxBase = "https://api-sandbox.shiprocket.in/v1/external";

async function readJson(response: Response) {
  const text = await response.text();
  try { return JSON.parse(text) as Record<string, unknown>; } catch { return { message: text || response.statusText }; }
}

export async function shiprocketToken() {
  const email = process.env.SHIPROCKET_SANDBOX_EMAIL;
  const password = process.env.SHIPROCKET_SANDBOX_PASSWORD;
  if (!email || !password) {
    throw new Error("Shiprocket sandbox is not configured.");
  }
  const response = await fetch(`${sandboxBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await readJson(response);
  const token = typeof data.token === "string" ? data.token : null;
  if (!response.ok || !token) throw new Error(typeof data.message === "string" ? `Shiprocket sign-in failed: ${data.message}` : "Shiprocket sandbox sign-in failed.");
  return token;
}

export async function shiprocketPost(path: string, payload: Record<string, unknown>, token: string) {
  const response = await fetch(`${sandboxBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(typeof data.message === "string" ? `Shiprocket: ${data.message}` : "Shiprocket could not complete this request.");
  return data;
}

export async function shiprocketGet(path: string, token: string) {
  const response = await fetch(`${sandboxBase}${path}`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
  const data = await readJson(response);
  if (!response.ok) throw new Error(typeof data.message === "string" ? `Shiprocket: ${data.message}` : "Shiprocket could not complete this request.");
  return data;
}

export function stringAt(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === "string" || typeof record[key] === "number") return String(record[key]);
  }
  for (const nested of [record.data, record.response]) {
    const found = stringAt(nested, keys);
    if (found) return found;
  }
  return null;
}
