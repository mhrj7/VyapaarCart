import { publicImageUrl } from "../../../lib/object-storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return new Response("Not found", { status: 404 });
  const url = publicImageUrl(key);
  if (!url) return new Response("Not found", { status: 404 });
  return Response.redirect(url, 308);
}
