import { auth } from "@clerk/nextjs/server";

export async function requireUser(request: Request) {
  void request;
  const { userId } = await auth();
  return userId ? { clerkId: userId } : null;
}
