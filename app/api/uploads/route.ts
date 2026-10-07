import { put } from "@vercel/blob";
import { requireUser } from "../../../lib/auth";
import { routeError } from "../../../lib/marketplace";

export const dynamic = "force-dynamic";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const identity = await requireUser(request);
    if (!identity) return Response.json({ error: "Sign in to upload an image." }, { status: 401 });
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File) || !allowedTypes.has(image.type) || image.size > maxBytes) {
      return Response.json({ error: "Upload a JPG, PNG, or WebP image under 5 MB." }, { status: 400 });
    }
    const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
    const key = `listings/${identity.clerkId}/${crypto.randomUUID()}.${extension}`;
    const blob = await put(key, image, { access: "public", contentType: image.type });
    return Response.json({ imageKey: blob.url, imageUrl: blob.url }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
