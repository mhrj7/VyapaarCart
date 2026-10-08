import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { eq } from "drizzle-orm";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { getDb } from "../db";
import { categories, productImages, products, stores, users } from "../db/schema";
import { issueAccessToken } from "../lib/api-tokens";
import { DELETE, GET, PATCH, POST } from "../app/api/products/[id]/images/route";

// Explicit opt-in: only run against an isolated local Postgres, never production.
test("media API: real SQL persistence, order, ownership, S3 deletion and failed-cleanup retry", { skip: process.env.RUN_MEDIA_INTEGRATION !== "1" }, async () => {
  assert.match(process.env.DATABASE_URL ?? "", /@(db|localhost|127\.0\.0\.1)(:|\/)/);
  process.env.JWT_AUTH_SECRET = "local-media-test-signing-secret-32-bytes-minimum";
  const objects = new Map<string, Buffer>();
  let rejectDelete = false;
  const server = createServer(async (request, response) => {
    const key = request.url!.split("?")[0];
    if (request.method === "PUT") {
      const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
      objects.set(key, Buffer.concat(chunks)); response.end();
    } else if (request.method === "DELETE") {
      if (rejectDelete) { response.statusCode = 403; response.end("<Error><Code>AccessDenied</Code></Error>"); }
      else { objects.delete(key); response.statusCode = 204; response.end(); }
    } else { response.statusCode = objects.has(key) ? 200 : 404; response.end(objects.get(key)); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  process.env.S3_ENDPOINT = `http://127.0.0.1:${address.port}`;
  process.env.S3_PUBLIC_BASE_URL = `${process.env.S3_ENDPOINT}/media-test`;
  process.env.S3_REGION = "us-east-1"; process.env.S3_BUCKET = "media-test";
  process.env.S3_ACCESS_KEY_ID = "local-test"; process.env.S3_SECRET_ACCESS_KEY = "local-test";
  const db = getDb(); const suffix = crypto.randomUUID(); const clerkId = `media-test-${suffix}`;
  let ownerId: number | undefined; let strangerId: number | undefined;
  const categoryId = `media-category-${suffix}`, storeId = crypto.randomUUID(), productId = crypto.randomUUID();
  const context = { params: Promise.resolve({ id: productId }) };
  try {
    const [owner] = await db.insert(users).values({ clerkId, role: "seller", sellerApprovalStatus: "approved" }).returning(); ownerId = owner.id;
    const [stranger] = await db.insert(users).values({ clerkId: `stranger-${suffix}`, role: "seller", sellerApprovalStatus: "approved" }).returning(); strangerId = stranger.id;
    await db.insert(categories).values({ id: categoryId, name: "Media test", slug: categoryId });
    await db.insert(stores).values({ id: storeId, ownerId, name: "Media test", slug: suffix, description: "Isolated verification", city: "Bengaluru" });
    await db.insert(products).values({ id: productId, storeId, categoryId, title: "Gallery test", description: "Test", price: 1 });
    const token = await issueAccessToken({ clerkId });
    const strangerToken = await issueAccessToken({ clerkId: stranger.clerkId });
    const request = (method: string, body?: unknown, auth = token) => new Request("http://localhost/api/images", { method, headers: { Authorization: `Bearer ${auth}`, ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}) }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=", "base64");
    const upload = async (alt: string) => {
      const form = new FormData(); form.set("image", new File([png], "test.png", { type: "image/png" })); form.set("altText", alt);
      const response = await POST(request("POST", form), context); assert.equal(response.status, 201);
      return (await response.json()).image;
    };
    const first = await upload("Front"), second = await upload("Back");
    assert.equal(objects.size, 2);
    assert.equal((await GET(request("GET", undefined, strangerToken), context)).status, 404);
    assert.equal((await DELETE(request("DELETE", { imageId: first.id }, strangerToken), context)).status, 404);
    assert.equal((await PATCH(request("PATCH", { imageIds: [first.id, first.id] }), context)).status, 409);
    assert.equal((await PATCH(request("PATCH", { imageIds: [second.id, first.id] }), context)).status, 200);
    const reloaded = (await (await GET(request("GET"), context)).json()).images;
    assert.deepEqual(reloaded.map((image: { id: string }) => image.id), [second.id, first.id]);
    assert.equal(reloaded[0].altText, "Back"); assert.equal(reloaded[0].sizeBytes, png.length);
    const malformed = new FormData(); malformed.set("image", new File(["not an image"], "bad.png", { type: "image/png" }));
    assert.equal((await POST(request("POST", malformed), context)).status, 400);
    assert.equal(objects.size, 2);
    rejectDelete = true;
    assert.equal((await DELETE(request("DELETE", { imageId: first.id }), context)).status, 502);
    const [pending] = await db.select().from(productImages).where(eq(productImages.id, first.id));
    assert.equal(pending.status, "deleting"); assert.equal(objects.size, 2);
    rejectDelete = false;
    assert.equal((await DELETE(request("DELETE", { imageId: first.id }), context)).status, 200);
    assert.equal(objects.size, 1); assert.equal((await db.select().from(productImages).where(eq(productImages.id, first.id))).length, 0);
    assert.equal((await DELETE(request("DELETE", { imageId: second.id }), context)).status, 200);
    assert.equal(objects.size, 0);
  } finally {
    await db.delete(productImages).where(eq(productImages.productId, productId));
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(stores).where(eq(stores.id, storeId));
    await db.delete(categories).where(eq(categories.id, categoryId));
    if (ownerId) await db.delete(users).where(eq(users.id, ownerId));
    if (strangerId) await db.delete(users).where(eq(users.id, strangerId));
    server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await (db as ReturnType<typeof drizzlePostgres>).$client.end();
  }
});
