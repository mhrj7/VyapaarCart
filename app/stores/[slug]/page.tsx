import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "../../../db";
import { categories, productAttributes, productVariantAttributes, productVariants, products, stores, users } from "../../../db/schema";

export const dynamic = "force-dynamic";

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();
  const [row] = await db.select({ store: stores, ownerName: users.displayName }).from(stores).innerJoin(users, eq(stores.ownerId, users.id)).where(and(eq(stores.slug, slug), eq(stores.isPublic, true))).limit(1);
  if (!row) notFound();
  const productRows = await db.select({ product: products, category: categories }).from(products).innerJoin(categories, eq(products.categoryId, categories.id)).where(and(eq(products.storeId, row.store.id), eq(products.status, "active")));
  const ids = productRows.map((item) => item.product.id);
  const attributes = ids.length ? await db.select().from(productAttributes).where(inArray(productAttributes.productId, ids)) : [];
  const byProduct = new Map<string, { key: string; value: string }[]>();
  for (const attribute of attributes) byProduct.set(attribute.productId, [...(byProduct.get(attribute.productId) ?? []), { key: attribute.key, value: attribute.value }]);
  const variants = ids.length ? await db.select().from(productVariants).where(inArray(productVariants.productId, ids)).orderBy(asc(productVariants.name)) : [];
  const variantIds = variants.map((variant) => variant.id);
  const variantAttributes = variantIds.length ? await db.select().from(productVariantAttributes).where(inArray(productVariantAttributes.variantId, variantIds)) : [];
  const byVariant = new Map<string, { key: string; value: string }[]>();
  for (const attribute of variantAttributes) byVariant.set(attribute.variantId, [...(byVariant.get(attribute.variantId) ?? []), { key: attribute.key, value: attribute.value }]);
  const variantsByProduct = new Map<string, typeof variants>();
  for (const variant of variants) variantsByProduct.set(variant.productId, [...(variantsByProduct.get(variant.productId) ?? []), variant]);
  return <main className="store-page"><header><Link href="/">← Marketplace</Link><b>Vyapaar<span>Cart</span></b></header><section className="store-hero"><p>PUBLIC SELLER STORE</p><h1>{row.store.name}</h1><span>{row.store.city} · by {row.ownerName}</span><div>{row.store.description}</div></section><section><h2>Products</h2>{productRows.length === 0 ? <p className="empty">This store is preparing its first product.</p> : <div className="products">{productRows.map(({ product, category }) => <article key={product.id}><div className="product-mark">✦</div><small>{category.name}</small><b>{product.title}</b><p>{product.description}</p>{(byProduct.get(product.id) ?? []).length > 0 && <em>{(byProduct.get(product.id) ?? []).map((attribute) => `${attribute.key.replace(/_/g, " ")}: ${attribute.value}`).join(" · ")}</em>}<strong>From ₹{product.price.toLocaleString("en-IN")}</strong><ul>{(variantsByProduct.get(product.id) ?? []).map((variant) => <li key={variant.id}><b>{variant.name}</b> · {variant.sku} · ₹{variant.price.toLocaleString("en-IN")}{(byVariant.get(variant.id) ?? []).length > 0 && ` · ${(byVariant.get(variant.id) ?? []).map((attribute) => `${attribute.key}: ${attribute.value}`).join(", ")}`}</li>)}</ul></article>)}</div>}</section><style>{`.store-page{min-height:100vh;background:#f8f7f1;color:#17251f;padding:0 5vw 70px}.store-page header,.store-page section{max-width:1100px;margin:auto}.store-page header{height:78px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #dfe2d9}.store-page header a{color:#1f8a58;text-decoration:none;font-size:13px;font-weight:700}.store-page header b{font-size:20px}.store-page header span,.store-hero>p,.products small{color:#1f8a58}.store-hero{padding:78px 0 45px}.store-hero>p{font:600 10px ui-monospace,monospace;letter-spacing:.13em}.store-hero h1{font-size:clamp(42px,7vw,76px);letter-spacing:-4px;line-height:.9;margin:14px 0}.store-hero span,.store-hero div{color:#68746e}.store-hero div{max-width:620px;line-height:1.6;margin-top:22px}.store-page h2{font-size:27px}.products{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.products article{background:#fff;border:1px solid #e4e5df;border-radius:16px;padding:17px;display:grid;gap:9px}.product-mark{height:150px;border-radius:11px;background:#e8eee1;display:grid;place-items:center;font-size:32px;color:#1f8a58}.products p,.products em,.empty,.products li{color:#68746e;font-size:13px;line-height:1.5;margin:0}.products em{font-style:normal;font-size:11px}.products strong{font-size:15px}.products ul{margin:0;padding-left:16px;display:grid;gap:3px}@media(max-width:700px){.store-page{padding:0 20px 40px}.products{grid-template-columns:1fr}.store-hero{padding:55px 0 30px}.store-hero h1{letter-spacing:-2.5px}}`}</style></main>;
}
