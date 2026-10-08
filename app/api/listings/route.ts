import { and, asc, desc, eq, gte, like, lte, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { listings, sellerApprovalAudits, users } from "../../../db/schema";
import { requireUser } from "../../../lib/auth";
import {
  ensureUser,
  routeError,
  serializeListing,
} from "../../../lib/marketplace";
import { isListingImageKey } from "../../../lib/object-storage";
import { canManageSeller, canOperateStore } from "../../../lib/authorization";

export const dynamic = "force-dynamic";

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const params = new URL(request.url).searchParams;
    const category = cleanText(params.get("category"), 40);
    const city = cleanText(params.get("city"), 80);
    const query = cleanText(params.get("q"), 100);
    const minPrice = Number(params.get("minPrice"));
    const maxPrice = Number(params.get("maxPrice"));
    const sort = params.get("sort");
    const filters = [eq(listings.status, "active")];
    if (category) filters.push(eq(listings.category, category));
    if (city) filters.push(like(listings.city, `%${city}%`));
    if (query)
      filters.push(
        or(
          like(listings.title, `%${query}%`),
          like(listings.description, `%${query}%`),
          like(listings.city, `%${query}%`),
        )!,
      );
    if (Number.isSafeInteger(minPrice) && minPrice > 0)
      filters.push(gte(listings.price, minPrice));
    if (Number.isSafeInteger(maxPrice) && maxPrice > 0)
      filters.push(lte(listings.price, maxPrice));
    const order =
      sort === "price_low"
        ? asc(listings.price)
        : sort === "price_high"
          ? desc(listings.price)
          : desc(listings.createdAt);
    const rows = await db
      .select({ listing: listings, sellerName: users.displayName })
      .from(listings)
      .innerJoin(users, eq(listings.sellerId, users.id))
      .where(and(...filters))
      .orderBy(order)
      .limit(48);
    return Response.json({
      listings: rows.map((row) =>
        serializeListing(row.listing, row.sellerName),
      ),
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity)
      return Response.json(
        { error: "Sign in to create a listing." },
        { status: 401 },
      );
    const payload = (await request.json()) as Record<string, unknown>;
    const title = cleanText(payload.title, 100);
    const description = cleanText(payload.description, 1500);
    const category = cleanText(payload.category, 40);
    const city = cleanText(payload.city, 80);
    const conditionLabel = cleanText(payload.conditionLabel, 30);
    const price = Number(payload.price);
    const imageKey =
      typeof payload.imageKey === "string" ? payload.imageKey : null;

    if (
      !title ||
      !description ||
      !category ||
      !city ||
      !conditionLabel ||
      !Number.isSafeInteger(price) ||
      price < 1
    ) {
      return Response.json(
        { error: "Complete all listing fields with a valid price." },
        { status: 400 },
      );
    }
    if (imageKey && !isListingImageKey(imageKey, identity.clerkId)) {
      return Response.json(
        { error: "That image does not belong to your account." },
        { status: 403 },
      );
    }

    const db = getDb();
    const seller = await ensureUser(db, identity.clerkId);
    const actor = { id: seller.id, clerkId: seller.clerkId, role: seller.role as "buyer" | "seller" | "seller_staff" | "admin", staffForSellerId: seller.staffForSellerId, sellerApprovalStatus: seller.sellerApprovalStatus as "not_requested" | "pending" | "approved" | "rejected" };
    if (!canOperateStore(actor)) {
      if (seller.role === "buyer" && seller.sellerApprovalStatus !== "pending") {
        const now = new Date().toISOString();
        await db.update(users).set({ sellerApprovalStatus: "pending", sellerApprovalRequestedAt: now }).where(eq(users.id, seller.id));
        await db.insert(sellerApprovalAudits).values({ id: crypto.randomUUID(), sellerId: seller.id, action: "requested", previousStatus: seller.sellerApprovalStatus, nextStatus: "pending", createdAt: now });
        return Response.json({ error: "Your seller approval request was submitted. An administrator must approve it before you can publish." }, { status: 202 });
      }
      return Response.json({ error: "Seller approval is required before you can publish listings." }, { status: 403 });
    }
    const sellerId = seller.role === "seller_staff" ? seller.staffForSellerId : seller.id;
    if (!sellerId || !canManageSeller(actor, sellerId)) return Response.json({ error: "Seller assignment is required." }, { status: 403 });
    const listing = {
      id: crypto.randomUUID(),
      sellerId,
      title,
      description,
      category,
      price,
      city,
      conditionLabel,
      imageKey,
    };
    await db.insert(listings).values(listing);
    return Response.json(
      {
        listing: serializeListing(
          {
            ...listing,
            status: "active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          seller.displayName,
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
