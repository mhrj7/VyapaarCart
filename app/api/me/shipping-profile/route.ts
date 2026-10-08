import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { sellerPickupProfiles } from "../../../../db/schema";
import { requireUser } from "../../../../lib/auth";
import { actorFor, routeError } from "../../../../lib/marketplace";
import { canOperateStore, sellerAccountId } from "../../../../lib/authorization";

export const dynamic = "force-dynamic";
const required = ["contactName", "email", "phone", "address", "city", "state", "pincode"] as const;
type Input = Record<(typeof required)[number], string>;

function valid(input: Partial<Input>) {
  return required.every((key) => input[key]?.trim()) && /^\d{6}$/.test(input.pincode || "") && (input.phone || "").replace(/\D/g, "").length >= 10;
}

export async function GET(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to view shipping setup." }, { status: 401 });
    const db = getDb();
    const seller = await actorFor(db, identity.clerkId);
    const sellerId = sellerAccountId(seller);
    if (!sellerId || !canOperateStore(seller)) return Response.json({ error: "Seller approval is required before you can manage shipping setup." }, { status: 403 });
    const [profile] = await db.select().from(sellerPickupProfiles).where(eq(sellerPickupProfiles.sellerId, sellerId)).limit(1);
    return Response.json({ profile: profile || null });
  } catch (error) { return routeError(error); }
}

export async function PUT(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to save shipping setup." }, { status: 401 });
    const input = await request.json() as Partial<Input>;
    if (!valid(input)) return Response.json({ error: "Enter a full address, a 6-digit pincode and a 10-digit phone number." }, { status: 400 });
    const db = getDb();
    const seller = await actorFor(db, identity.clerkId);
    const sellerId = sellerAccountId(seller);
    if (!sellerId || !canOperateStore(seller)) return Response.json({ error: "Seller approval is required before you can manage shipping setup." }, { status: 403 });
    const profile = {
      sellerId, pickupLocation: `vyapaarcart-${sellerId}`, contactName: input.contactName!.trim(), email: input.email!.trim(), phone: input.phone!.trim(),
      address: input.address!.trim(), city: input.city!.trim(), state: input.state!.trim(), pincode: input.pincode!.trim(), country: "India", updatedAt: new Date().toISOString(),
    };
    await db.insert(sellerPickupProfiles).values(profile).onConflictDoUpdate({ target: sellerPickupProfiles.sellerId, set: profile });
    return Response.json({ profile });
  } catch (error) { return routeError(error); }
}
