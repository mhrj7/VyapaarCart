import { isListingImageUrl } from "../../../lib/marketplace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key || !isListingImageUrl(key)) return new Response("Not found", { status: 404 });
  return Response.redirect(key, 308);
}
