import { getDb } from "../../../../../db";
import { requireUser } from "../../../../../lib/auth";
import { actorFor, routeError } from "../../../../../lib/marketplace";
import { buyerReservation } from "../../../../../lib/reservation-service";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in required." }, { status: 401 });
    const actor = await actorFor(getDb(), identity.clerkId);
    const reservation = await buyerReservation(actor, (await params).id);
    return reservation ? Response.json({ reservation }, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "Checkout not found." }, { status: 404 });
  } catch (error) { return routeError(error); }
}
