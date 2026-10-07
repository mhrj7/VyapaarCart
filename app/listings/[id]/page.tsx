import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { listings, users } from "../../../db/schema";
import { imageUrl } from "../../../lib/marketplace";

type Props = { params: Promise<{ id: string }> };

async function loadListing(id: string) {
  const db = getDb();
  const [row] = await db
    .select({ listing: listings, sellerName: users.displayName })
    .from(listings)
    .innerJoin(users, eq(listings.sellerId, users.id))
    .where(eq(listings.id, id))
    .limit(1);
  return row?.listing.status === "active" ? row : null;
}

function postedAt(value: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const row = await loadListing(id);
  if (!row)
    return {
      title: "Listing not found | VyapaarCart",
      openGraph: { images: [] },
      twitter: { images: [] },
    };
  const requestHeaders = await headers();
  const origin = `${requestHeaders.get("x-forwarded-proto") ?? "https"}://${requestHeaders.get("host") ?? "vyapaarcart.local"}`;
  const photo = imageUrl(row.listing.imageKey);
  const description = `${row.listing.conditionLabel} · ₹${row.listing.price.toLocaleString("en-IN")} · ${row.listing.city}. ${row.listing.description.slice(0, 120)}`;
  return {
    title: `${row.listing.title} | VyapaarCart`,
    description,
    openGraph: {
      title: row.listing.title,
      description,
      images: photo
        ? [{ url: `${origin}${photo}`, alt: row.listing.title }]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: row.listing.title,
      description,
      images: photo ? [`${origin}${photo}`] : [],
    },
  };
}

export default async function ListingDetailPage({ params }: Props) {
  const { id } = await params;
  const row = await loadListing(id);
  if (!row) notFound();
  const { listing, sellerName } = row;
  const photo = imageUrl(listing.imageKey);
  return (
    <main className="detail-page">
      <DetailStyles />
      <header>
        <Link href="/" className="detail-brand">
          V<span>yapaar</span>Cart
        </Link>
        <Link href="/" className="back-link">
          ← Browse listings
        </Link>
      </header>
      <section className="detail-shell">
        <div className="detail-photo">
          {photo ? <img src={photo} alt={listing.title} /> : <span>✦</span>}
          <small>{listing.conditionLabel}</small>
        </div>
        <article className="detail-copy">
          <p className="detail-eyebrow">
            {listing.category} · {listing.city}
          </p>
          <h1>{listing.title}</h1>
          <p className="detail-price">
            ₹{listing.price.toLocaleString("en-IN")}
          </p>
          <p className="detail-meta">
            Posted {postedAt(listing.createdAt)} · Available now
          </p>
          <p className="detail-description">{listing.description}</p>
          <div className="seller-card">
            <span>{sellerName.slice(0, 1).toUpperCase()}</span>
            <div>
              <b>{sellerName}</b>
              <small>Verified VyapaarCart seller</small>
            </div>
          </div>
          <div className="detail-actions">
            <Link className="primary-action" href="/">
              Sign in to contact seller
            </Link>
            <Link className="secondary-action" href="/">
              Save listing
            </Link>
          </div>
          <p className="detail-note">
            This listing URL is safe to share. Payments and delivery remain in
            test mode.
          </p>
        </article>
      </section>
    </main>
  );
}

function DetailStyles() {
  return (
    <style>{`
.detail-page{min-height:100vh;background:#f8f7f1;color:#17251f;padding:0 5vw 64px}.detail-page header{height:80px;max-width:1100px;margin:auto;border-bottom:1px solid #dfe2d9;display:flex;align-items:center;justify-content:space-between}.detail-brand{color:#17251f;text-decoration:none;font-weight:800;font-size:21px;letter-spacing:-1px}.detail-brand span{color:#1f8a58}.back-link{color:#1f8a58;font-size:13px;font-weight:700;text-decoration:none}.detail-shell{max-width:1100px;margin:56px auto;display:grid;grid-template-columns:1fr .9fr;gap:58px;align-items:start}.detail-photo{height:510px;border-radius:22px;background:linear-gradient(135deg,#d7eadf,#eaf0d8);position:relative;overflow:hidden;display:grid;place-items:center}.detail-photo img{width:100%;height:100%;object-fit:cover}.detail-photo>span{font-size:170px}.detail-photo small{position:absolute;left:16px;bottom:16px;padding:7px 10px;background:rgba(255,255,255,.9);border-radius:18px;font-size:11px;font-weight:700}.detail-eyebrow{font:700 10px ui-monospace,monospace;color:#1f8a58;letter-spacing:.12em;margin:5px 0 15px}.detail-copy h1{font-size:45px;line-height:1;letter-spacing:-2px;margin:0 0 17px}.detail-price{font-size:27px;font-weight:800;margin:0}.detail-meta{font-size:12px;color:#708078;margin:9px 0 28px}.detail-description{font-size:15px;line-height:1.65;color:#45554d}.seller-card{display:flex;gap:11px;align-items:center;border-top:1px solid #dfe2d9;border-bottom:1px solid #dfe2d9;padding:18px 0;margin:30px 0}.seller-card>span{width:39px;height:39px;border-radius:50%;display:grid;place-items:center;background:#d9fa6a;font-weight:800}.seller-card div{display:grid;gap:3px;font-size:13px}.seller-card small{font-size:11px;color:#708078}.detail-actions{display:flex;gap:10px}.primary-action,.secondary-action{padding:13px 16px;border-radius:9px;font-weight:700;font-size:13px;text-decoration:none}.primary-action{background:#17251f;color:white}.secondary-action{color:#17251f;border:1px solid #bdc7bf}.detail-note{font-size:11px;line-height:1.5;color:#77837d;margin-top:18px}@media(max-width:720px){.detail-page{padding:0 20px 36px}.detail-page header{height:64px}.detail-shell{margin:32px auto;grid-template-columns:1fr;gap:28px}.detail-photo{height:330px;border-radius:16px}.detail-copy h1{font-size:37px}.detail-actions{flex-direction:column}}
`}</style>
  );
}
