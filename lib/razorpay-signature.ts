function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function createRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  secret: string,
) {
  const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return [...new Uint8Array(signature)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  providedSignature: string,
  secret: string,
) {
  const expectedSignature = await createRazorpaySignature(
    razorpayOrderId,
    razorpayPaymentId,
    secret,
  );
  return constantTimeEqual(expectedSignature, providedSignature);
}
