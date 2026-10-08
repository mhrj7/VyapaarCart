import { and, asc, desc, eq, gte, like, lte, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { listings, users } from "../../../db/schema";
import { requireUser } from "../../../lib/auth";
import {
  ensureUser,
  routeError,
  serializeListing,
} from "../../../lib/marketplace";
import { isListingImageKey } from "../../../lib/object-storage";
import { canManageSeller } from "../../../lib/authorization";

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
    let seller = await ensureUser(db, identity.clerkId);
    if (seller.role === "buyer") {
      [seller] = await db.update(users).set({ role: "seller" }).where(eq(users.id, seller.id)).returning();
    }
    if (seller.role !== "seller" && seller.role !== "seller_staff" && seller.role !== "admin") return Response.json({ error: "Only sellers can create listings." }, { status: 403 });
    const sellerId = seller.role === "seller_staff" ? seller.staffForSellerId : seller.id;
    if (!sellerId || !canManageSeller({ id: seller.id, clerkId: seller.clerkId, role: seller.role as "seller" | "seller_staff" | "admin", staffForSellerId: seller.staffForSellerId }, sellerId)) return Response.json({ error: "Seller assignment is required." }, { status: 403 });
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
