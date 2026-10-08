import { auth } from "@clerk/nextjs/server";
import { verifyAccessToken } from "./api-tokens";

export async function requireUser(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (token) {
    const identity = await verifyAccessToken(token);
    if (identity) return identity;
  }
  const { userId } = await auth();
  return userId ? { clerkId: userId } : null;
}
