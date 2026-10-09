import { checkoutItem } from "../../../../lib/reservation-service";
import { routeError } from "../../../../lib/marketplace";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const item = await checkoutItem(new URL(request.url).searchParams.get("variant") ?? "");
    return item ? Response.json({ item }, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "SKU unavailable." }, { status: 404 });
  } catch (error) { return routeError(error); }
}
