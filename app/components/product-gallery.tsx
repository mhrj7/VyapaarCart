"use client";

import Image from "next/image";
import { useState } from "react";

export type GalleryImage = { id: string; url: string; altText: string };

export default function ProductGallery({ images }: { images: GalleryImage[] }) {
  const [selectedId, setSelectedId] = useState(images[0]?.id);
  const selected = images.find((image) => image.id === selectedId) ?? images[0];
  if (!selected) return <div className="product-mark" aria-label="No product images">✦</div>;
  return <div className="product-gallery">
    <Image unoptimized src={selected.url} alt={selected.altText} width={640} height={480} style={{ width: "100%", height: 190, objectFit: "contain", background: "#f2f4ee", borderRadius: 11 }} />
    {images.length > 1 && <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 8 }} aria-label="Product images">{images.map((image, index) => <button key={image.id} type="button" aria-label={`Show image ${index + 1}: ${image.altText}`} aria-pressed={selected.id === image.id} onClick={() => setSelectedId(image.id)} style={{ padding: 2, border: `2px solid ${selected.id === image.id ? "#1f8a58" : "#e4e5df"}`, borderRadius: 7, background: "white", flexShrink: 0, cursor: "pointer" }}><Image unoptimized src={image.url} alt="" width={48} height={48} style={{ objectFit: "cover" }} /></button>)}</div>}
    <small aria-live="polite">Image {images.indexOf(selected) + 1} of {images.length}</small>
  </div>;
}
