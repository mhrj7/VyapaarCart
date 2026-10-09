import { getDb } from "../../../../db";
import { requireUser } from "../../../../lib/auth";
import { actorFor, routeError } from "../../../../lib/marketplace";
import { buyerReservation, reservationInput, reserveInventory } from "../../../../lib/reservation-service";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in required." }, { status: 401 });
    const input = reservationInput(await request.json().catch(() => null));
    if (!input) return Response.json({ error: "Choose a SKU and quantity from 1 to 20. Price and expiry are set by the server." }, { status: 400 });
    const actor = await actorFor(getDb(), identity.clerkId);
    const outcome = await reserveInventory(actor, input);
    const messages: Record<string, string> = {
      forbidden: "Use a buyer or seller account for checkout.", own_store: "You cannot reserve your own store's stock.",
      not_found: "This SKU is not available for checkout.", insufficient: "Not enough available stock. Refresh availability.",
      key_conflict: "This request key was already used for another checkout.", already_held: "You already have an active checkout for this SKU.", invalid: "Invalid reservation request.",
    };
    if (outcome.error) return Response.json({ error: messages[outcome.error] ?? "Reservation failed.", reservationId: outcome.id }, { status: outcome.error === "forbidden" || outcome.error === "own_store" ? 403 : outcome.error === "not_found" ? 404 : 409 });
    return Response.json({ reservation: await buyerReservation(actor, outcome.id!) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return routeError(error); }
}
