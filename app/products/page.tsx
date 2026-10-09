import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { categories, stores } from "../../db/schema";
import { parseProductSearch, searchProducts, SearchInputError } from "../../lib/product-search";
import { publicImageUrl } from "../../lib/object-storage";
import ProductGallery from "../components/product-gallery";

export const dynamic = "force-dynamic";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") params.set(key, value);
  let input;
  try { input = parseProductSearch(params); } catch (error) {
    if (!(error instanceof SearchInputError)) throw error;
    return <main className="p-8"><h1>Invalid search</h1><p>{error.message}</p><Link href="/products">Reset search</Link></main>;
  }
  const db = getDb();
  const [result, categoryOptions, storeOptions] = await Promise.all([
    searchProducts(input), db.select().from(categories).orderBy(asc(categories.name)),
    db.select({ ownerId: stores.ownerId, name: stores.name }).from(stores).where(eq(stores.isPublic, true)).orderBy(asc(stores.name)),
  ]);
  const sellers = new Map<number, string[]>();
  for (const store of storeOptions) sellers.set(store.ownerId, [...(sellers.get(store.ownerId) ?? []), store.name]);
  const pageUrl = (offset: number) => { const next = new URLSearchParams(params); next.set("offset", String(offset)); return `/products?${next}`; };
  return <main className="catalog-page">
    <header><Link href="/">← Marketplace</Link><b>VyapaarCart</b></header>
    <section><p className="eyebrow">PUBLIC PRODUCT CATALOG</p><h1>Find your next good thing.</h1><p>Search product titles and descriptions. Filter by category and seller.</p>
      <form key={`${input.q}:${input.category}:${input.seller}`} action="/products" className="catalog-filters">
        <label>Search products<input type="search" name="q" defaultValue={input.q} maxLength={100} placeholder="Phone, wireless headphones…" /></label>
        <label>Category<select name="category" defaultValue={input.category}><option value="">All categories</option>{categoryOptions.map((c) => <option value={c.slug} key={c.id}>{c.name}</option>)}</select></label>
        <label>Seller<select name="seller" defaultValue={input.seller || ""}><option value="">All sellers</option>{[...sellers].map(([id, names]) => <option value={id} key={id}>{names.join(" / ")}</option>)}</select></label>
        {input.attributeKey && <><input type="hidden" name="attributeKey" value={input.attributeKey} /><input type="hidden" name="attributeValue" value={input.attributeValue} /></>}
        <button type="submit">Search</button><Link href="/products">Clear filters</Link>
      </form>
      <p role="status">{result.products.length ? `${result.products.length} products on this page` : "No products match your search. Try another query or clear the filters."}{input.q && " · Best matches first"}</p>
      <div className="catalog-results">{result.products.map((product) => <article key={product.id}>
        <ProductGallery images={product.images.flatMap((image) => { const url = publicImageUrl(image.objectKey); return url ? [{ id: image.id, url, altText: image.altText }] : []; })} />
        <small>{product.category.name}</small><h2>{product.title}</h2><p>{product.description}</p>
        <strong>From ₹{product.price.toLocaleString("en-IN")}</strong><Link href={`/stores/${product.store.slug}`}>Sold by {product.store.name} ↗</Link>
      </article>)}</div>
      <nav aria-label="Search result pages">{input.offset > 0 && <Link href={pageUrl(Math.max(0, input.offset - input.limit))}>← Previous page</Link>}{result.pagination.nextOffset !== null && <Link href={pageUrl(result.pagination.nextOffset)}>Next page →</Link>}</nav>
    </section>
    <style>{`.catalog-page{min-height:100vh;background:#f8f7f1;color:#17251f;padding:0 5vw 60px}.catalog-page header,.catalog-page section{max-width:1100px;margin:auto}.catalog-page header{display:flex;justify-content:space-between;align-items:center;height:78px;border-bottom:1px solid #dfe2d9}.catalog-page a{color:#1f8a58}.catalog-page section{padding-top:45px}.catalog-page h1{font-size:clamp(30px,5vw,56px);line-height:1.1;letter-spacing:-2px}.eyebrow{font:600 11px ui-monospace,monospace;color:#1f8a58}.catalog-filters{display:flex;flex-wrap:wrap;align-items:end;gap:14px;margin:30px 0}.catalog-filters label{display:grid;gap:6px;font-size:13px;flex:1;min-width:150px}.catalog-filters input,.catalog-filters select{border:1px solid #dfe2d9;border-radius:8px;padding:12px;background:white;color:#17251f;min-width:0;width:100%}.catalog-filters button{background:#17251f;color:white;border:0;border-radius:8px;padding:13px 22px}.catalog-results{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.catalog-results article{background:white;border:1px solid #e4e5df;border-radius:16px;padding:17px;display:grid;gap:10px}.catalog-results h2{font-size:18px;margin:0}.catalog-results p{font-size:13px;color:#68746e;margin:0;line-height:1.5}.catalog-results small{color:#1f8a58}.catalog-results a{font-size:13px}.catalog-page nav{display:flex;gap:24px;margin-top:25px}@media(max-width:700px){.catalog-results{grid-template-columns:1fr}.catalog-filters label{flex-basis:100%}}`}</style>
  </main>;
}
