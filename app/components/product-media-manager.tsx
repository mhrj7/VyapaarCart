"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type Media = { id: string; url: string; altText: string; status: string };
type Requester = (path: string, init?: RequestInit) => Promise<Response>;

export default function ProductMediaManager({ productId, title, request }: { productId: string; title: string; request: Requester }) {
  const [images, setImages] = useState<Media[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const path = `/api/products/${productId}/images`;
  const load = useCallback(async () => {
    const response = await request(path);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load images.");
    setImages(data.images);
  }, [path, request]);
  useEffect(() => { void load().catch((error: Error) => setNotice(error.message)); }, [load]);

  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setNotice("");
    try { await work(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Image action failed."); }
    finally {
      try { await load(); } catch (error) { setNotice(error instanceof Error ? error.message : "Reload failed."); }
      setBusy(false);
    }
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    await action(async () => {
      for (const file of selected) {
        const form = new FormData(); form.set("image", file); form.set("altText", `${title} — ${file.name}`);
        const response = await request(path, { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(`${file.name}: ${data.error}`);
      }
      setNotice(`${selected.length} image${selected.length === 1 ? "" : "s"} uploaded. First image is the cover.`);
    });
    if (input.current) input.current.value = "";
  }
  async function move(imageId: string, offset: number) {
    await action(async () => {
      const ids = images.filter((image) => image.status === "active").map((image) => image.id);
      const index = ids.indexOf(imageId);
      [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
      const response = await request(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageIds: ids }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice("Image order saved.");
    });
  }
  async function remove(imageId: string) {
    await action(async () => {
      const response = await request(path, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice("Image and stored file removed.");
    });
  }
  const activeIds = images.filter((image) => image.status === "active").map((image) => image.id);
  return <section aria-label={`Images for ${title}`} aria-busy={busy} style={{ borderTop: "1px solid #e4e5df", paddingTop: 10 }}>
    <b>Product images</b><p>Upload several JPG, PNG, or WebP files (up to 5 MB each). Move images to set the saved order; the first is your cover.</p>
    <label>Upload images<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(event) => void upload(event.target.files)} /></label>
    <div style={{ display: "grid", gap: 10 }}>{images.map((image) => <div key={image.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      {image.status === "active" && <Image unoptimized src={image.url} alt={image.altText} width={70} height={70} style={{ objectFit: "cover", borderRadius: 8 }} />}
      <span>{image.status === "active" ? (activeIds[0] === image.id ? "Cover image" : `Image ${activeIds.indexOf(image.id) + 1}`) : "Pending upload / cleanup"}</span>
      {image.status === "active" && <><button type="button" disabled={busy || activeIds.indexOf(image.id) === 0} aria-label={`Move ${image.altText} earlier`} onClick={() => void move(image.id, -1)}>← Earlier</button><button type="button" disabled={busy || activeIds.indexOf(image.id) === activeIds.length - 1} aria-label={`Move ${image.altText} later`} onClick={() => void move(image.id, 1)}>Later →</button></>}
      <button type="button" className="remove" disabled={busy} aria-label={`Remove ${image.altText}`} onClick={() => void remove(image.id)}>{image.status === "active" ? "Remove image" : "Retry removal"}</button>
    </div>)}</div>
    <p role="status" aria-live="polite">{busy ? "Saving images…" : notice}</p>
  </section>;
}
