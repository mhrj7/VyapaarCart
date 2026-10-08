import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { productImages, products, stores } from "../../../../../db/schema";
import { requireUser } from "../../../../../lib/auth";
import { canManageSeller } from "../../../../../lib/authorization";
import { actorFor, routeError } from "../../../../../lib/marketplace";
import { deleteListingImage, publicImageUrl, uploadListingImage } from "../../../../../lib/object-storage";
import { isCompleteImageOrder, maxProductImageBytes, productImageExtension } from "../../../../../lib/product-media";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };

async function ownerAccess(request: Request, id: string) {
  const identity = await requireUser(request);
  if (!identity) return null;
  const db = getDb();
  const actor = await actorFor(db, identity.clerkId);
  const [row] = await db.select({ product: products, store: stores }).from(products).innerJoin(stores, eq(products.storeId, stores.id)).where(eq(products.id, id)).limit(1);
  return row && canManageSeller(actor, row.store.ownerId) ? { db, product: row.product, clerkId: identity.clerkId } : null;
}

export async function GET(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const access = await ownerAccess(request, id);
    if (!access) return Response.json({ error: "Product not found." }, { status: 404 });
    const images = await access.db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.position), asc(productImages.id));
    return Response.json({ images: images.map((image) => ({ ...image, url: publicImageUrl(image.objectKey) })) });
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const access = await ownerAccess(request, id);
    if (!access) return Response.json({ error: "Product not found." }, { status: 404 });
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || file.size > maxProductImageBytes || !file.size) return Response.json({ error: "Choose a JPG, PNG, or WebP image up to 5 MB." }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extension = productImageExtension(bytes, file.type);
    if (!extension) return Response.json({ error: "The file contents must match a JPG, PNG, or WebP image." }, { status: 400 });
    const imageId = crypto.randomUUID();
    // Reuse the existing, least-privilege listing storage prefix. Product ownership
    // is enforced through metadata, never through a client-supplied object key.
    const key = `listings/${access.clerkId}/${imageId}.${extension}`;
    const altText = String(form.get("altText") || access.product.title).trim().slice(0, 200) || access.product.title;
    // Persist intent BEFORE uploading. A failed request retains cleanup metadata;
    // deleting a product cannot cascade away references to stored files.
    await access.db.execute(sql`INSERT INTO product_images (id, product_id, object_key, alt_text, content_type, size_bytes, position, status)
      SELECT ${imageId}, ${id}, ${key}, ${altText}, ${file.type}, ${file.size}, COALESCE(MAX(position), -1) + 1, 'pending'
      FROM product_images WHERE product_id = ${id}`);
    try {
      await uploadListingImage(key, bytes, file.type);
      const [image] = await access.db.update(productImages).set({ status: "active" }).where(and(eq(productImages.id, imageId), eq(productImages.status, "pending"))).returning();
      if (!image) throw new Error("Upload was cancelled.");
      return Response.json({ image: { ...image, url: publicImageUrl(key) } }, { status: 201 });
    } catch {
      await access.db.update(productImages).set({ status: "deleting" }).where(eq(productImages.id, imageId));
      try {
        await deleteListingImage(key);
        await access.db.delete(productImages).where(eq(productImages.id, imageId));
      } catch { /* Metadata remains available for the seller's cleanup retry. */ }
      return Response.json({ error: "Upload failed. Retry, or remove the pending image if cleanup is still needed." }, { status: 502 });
    }
  } catch (error) { return routeError(error); }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const access = await ownerAccess(request, id);
    if (!access) return Response.json({ error: "Product not found." }, { status: 404 });
    const { imageIds } = await request.json() as { imageIds?: unknown };
    const current = await access.db.select().from(productImages).where(and(eq(productImages.productId, id), eq(productImages.status, "active")));
    if (!current.length || !isCompleteImageOrder(imageIds, current.map((image) => image.id))) return Response.json({ error: "Send every current image exactly once. Reload if images changed." }, { status: 409 });
    const cases = imageIds.map((imageId, position) => sql`WHEN ${imageId} THEN ${position}::integer`);
    const ids = sql.join(imageIds.map((imageId) => sql`${imageId}`), sql`, `);
    // A single guarded SQL update makes the reorder atomic and rejects stale lists.
    const result = await access.db.execute(sql`UPDATE product_images SET position = CASE id ${sql.join(cases, sql` `)} END
      WHERE product_id = ${id} AND status = 'active'
      AND (SELECT count(*) FROM product_images WHERE product_id = ${id} AND status = 'active') = ${imageIds.length}
      AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = ${id} AND status = 'active' AND id NOT IN (${ids}))
      RETURNING id`);
    const rows = Array.isArray(result) ? result : result.rows;
    if (rows.length !== imageIds.length) return Response.json({ error: "Images changed. Reload and try again." }, { status: 409 });
    return Response.json({ reordered: true });
  } catch (error) { return routeError(error); }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const access = await ownerAccess(request, id);
    if (!access) return Response.json({ error: "Product not found." }, { status: 404 });
    const { imageId } = await request.json() as { imageId?: string };
    if (typeof imageId !== "string") return Response.json({ error: "Choose an image to remove." }, { status: 400 });
    const [image] = await access.db.select().from(productImages).where(and(eq(productImages.productId, id), eq(productImages.id, imageId))).limit(1);
    if (!image) return Response.json({ error: "Image not found." }, { status: 404 });
    if (image.status === "pending" && Date.now() - Date.parse(image.createdAt) < 120_000) return Response.json({ error: "Upload is still pending. Wait two minutes before retrying removal." }, { status: 409 });
    await access.db.update(productImages).set({ status: "deleting" }).where(eq(productImages.id, imageId));
    try { await deleteListingImage(image.objectKey); }
    catch { return Response.json({ error: "Image hidden, but storage removal failed. Retry removal to finish cleanup." }, { status: 502 }); }
    await access.db.delete(productImages).where(eq(productImages.id, imageId));
    return Response.json({ removed: true });
  } catch (error) { return routeError(error); }
}
