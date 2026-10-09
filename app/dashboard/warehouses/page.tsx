"use client";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Warehouse = { id: string; name: string; address: string; city: string; postcode: string };
type Stock = { variantId: string; sku: string; name: string; title: string; quantity: number; version: number };
type Requester = (path: string, init?: RequestInit) => Promise<Response>;
const empty = { name: "", address: "", city: "", postcode: "" };

function StockEditor({ row, save, busy }: { row: Stock; save: (row: Stock, quantity: number) => Promise<void>; busy: boolean }) {
  const [quantity, setQuantity] = useState(String(row.quantity));
  return <tr><td>{row.title}<br /><small>{row.name}</small></td><td>{row.sku}</td><td>{row.quantity}</td><td><form onSubmit={(e) => { e.preventDefault(); void save(row, Number(quantity)); }}><label className="sr-only" htmlFor={`stock-${row.variantId}`}>Quantity for {row.sku}</label><input id={`stock-${row.variantId}`} aria-label={`Quantity for ${row.sku}`} type="number" min="0" max="1000000" step="1" required value={quantity} onChange={(e) => setQuantity(e.target.value)} /><button disabled={busy} aria-label={`Save stock for ${row.sku}`}>Save</button></form></td></tr>;
}

function WarehouseManager({ storeId, request }: { storeId: string; request: Requester }) {
  const [items, setItems] = useState<Warehouse[]>([]);
  const [active, setActive] = useState("");
  const [inventory, setInventory] = useState<Stock[]>([]);
  const [draft, setDraft] = useState(empty);
  const [edit, setEdit] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const base = `/api/stores/${storeId}/warehouses`;
  const list = useCallback(async () => {
    const response = await request(base); const data = await response.json();
    if (!response.ok) throw Error(data.error || "Could not load warehouses.");
    setItems(data.warehouses); setActive((id) => id || data.warehouses[0]?.id || "");
  }, [base, request]);
  useEffect(() => { let stopped = false; void (async () => {
    try { const response = await request(base); const data = await response.json(); if (stopped) return;
      if (!response.ok) throw Error(data.error); setItems(data.warehouses); setActive(data.warehouses[0]?.id || "");
    } catch (error) { if (!stopped) setNotice(error instanceof Error ? error.message : "Could not load warehouses."); }
    finally { if (!stopped) setLoading(false); }
  })(); return () => { stopped = true; }; }, [base, request]);
  const reloadStock = useCallback(async () => {
    const r = await request(`${base}/${active}`); const data = await r.json();
    if (!r.ok) throw Error(data.error); setInventory(data.inventory); setEdit(data.warehouse);
  }, [active, base, request]);
  useEffect(() => { if (!active) return; let stopped = false; setInventory([]); setLoading(true);
    void (async () => { try { const r = await request(`${base}/${active}`); const data = await r.json(); if (stopped) return; if (!r.ok) throw Error(data.error); setInventory(data.inventory); setEdit(data.warehouse);
    } catch (error) { if (!stopped) setNotice(error instanceof Error ? error.message : "Could not load inventory."); } finally { if (!stopped) setLoading(false); } })();
    return () => { stopped = true; };
  }, [active, base, request]);
  async function mutate(path: string, method: string, body: unknown, success: string) {
    setBusy(true); setNotice("");
    try { const response = await request(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json();
      if (!response.ok) { if (response.status === 409) await reloadStock(); throw Error(data.error); }
      await list(); if (method === "POST") { setDraft(empty); setActive(data.warehouse.id); } else await reloadStock(); setNotice(success);
    } catch (error) { setNotice(error instanceof Error ? error.message : "The request failed. Try again."); }
    finally { setBusy(false); }
  }
  function fields(value: typeof empty, change: (value: typeof empty) => void) { return <>{(["name", "address", "city", "postcode"] as const).map((key) => <label key={key}>{key === "postcode" ? "Postcode" : key[0].toUpperCase() + key.slice(1)}<input required name={key} value={value[key]} maxLength={key === "address" ? 240 : key === "postcode" ? 6 : 80} pattern={key === "postcode" ? "[0-9]{6}" : undefined} onChange={(e) => change({ ...value, [key]: e.target.value })} /></label>)}</>; }
  return <>
    <div className="warehouse-grid"><section><h2>Add warehouse</h2><form onSubmit={(e: FormEvent) => { e.preventDefault(); void mutate(base, "POST", draft, "Warehouse created."); }}>{fields(draft, setDraft)}<button disabled={busy}>Create warehouse</button></form></section>
      <section><h2>Your warehouses</h2>{items.length === 0 && !loading && <p>No warehouses yet. Create your first location.</p>}<label>Warehouse<select disabled={busy || loading} value={active} onChange={(e) => { setActive(e.target.value); setNotice(""); }}><option value="" disabled>Choose a warehouse</option>{items.map((w) => <option key={w.id} value={w.id}>{w.name} — {w.city}</option>)}</select></label>
        {active && !loading && <form key={active} onSubmit={(e) => { e.preventDefault(); void mutate(`${base}/${active}`, "PATCH", edit, "Warehouse details saved."); }}>{fields(edit, setEdit)}<button disabled={busy}>Save warehouse details</button></form>}</section></div>
    <p role="status">{loading ? "Loading inventory…" : notice}</p>
    {active && !loading && <section className="inventory"><h2>Inventory at {items.find((w) => w.id === active)?.name}</h2><p>Each SKU has its own stock count at this warehouse. A SKU not yet recorded starts at zero. This does not reserve stock during checkout.</p>
      {inventory.length === 0 ? <p>Add product variants in your store to track stock here.</p> : <div className="table-scroll"><table><thead><tr><th>Product / variant</th><th>SKU</th><th>Recorded stock</th><th>Set quantity</th></tr></thead><tbody>{inventory.map((row) => <StockEditor key={`${active}:${row.variantId}:${row.version}`} row={row} busy={busy} save={async (r, quantity) => { await mutate(`${base}/${active}`, "PUT", { variantId: r.variantId, quantity, version: r.version }, "Stock saved."); }} />)}</tbody></table></div>}</section>}
  </>;
}

export default function WarehousesPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [storeId, setStoreId] = useState(""); const [error, setError] = useState("");
  const request = useCallback<Requester>(async (path, init = {}) => { const token = await getToken(); const headers = new Headers(init.headers); if (token) headers.set("Authorization", `Bearer ${token}`); return fetch(path, { ...init, headers }); }, [getToken]);
  useEffect(() => { if (!isLoaded || !isSignedIn) return; let stopped = false; void (async () => { try { const r = await request("/api/me/stores"); const data = await r.json(); if (stopped) return; if (!r.ok) throw Error(data.error); setStores(data.stores); setStoreId(data.stores[0]?.id || ""); } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : "Could not load stores."); } })(); return () => { stopped = true; }; }, [isLoaded, isSignedIn, request]);
  return <main className="warehouses"><header><Link href="/dashboard/stores">← My stores</Link><p>SELLER INVENTORY</p><h1>Warehouses & SKU stock</h1><p>Manage multiple locations and track stock separately at each one.</p></header>
    {!isLoaded ? <p>Loading…</p> : !isSignedIn ? <p>Please sign in from the marketplace to manage inventory.</p> : <><p role="alert">{error}</p><label>Store<select value={storeId} onChange={(e) => setStoreId(e.target.value)}><option value="" disabled>Choose a store</option>{stores.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>{storeId ? <WarehouseManager key={storeId} storeId={storeId} request={request} /> : <p>Create a store first.</p>}</>}
    <style>{`.warehouses{background:#f8f7f1;min-height:100vh;color:#17251f;padding:40px max(20px,5vw)}.warehouses>header,.warehouses>label,.warehouse-grid,.warehouses>p,.inventory{max-width:1100px;margin:0 auto 24px}.warehouses h1{font-size:42px;margin:20px 0}.warehouses a{color:#1f8a58}.warehouse-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.warehouses section{background:white;border:1px solid #dfe2d9;border-radius:16px;padding:24px}.warehouses label{display:grid;gap:6px;margin:12px 0}.warehouses input,.warehouses select{padding:12px;border:1px solid #dfe2d9;border-radius:8px;font:inherit;min-width:0}.warehouses button{padding:12px;background:#17251f;color:white;border:0;border-radius:8px;cursor:pointer}.warehouses button:disabled{opacity:.5}.warehouses td,.warehouses th{text-align:left;padding:12px;border-bottom:1px solid #dfe2d9}.warehouses td form{display:flex;gap:8px}.warehouses td input{width:110px}.table-scroll{overflow:auto}.warehouses table{width:100%;border-collapse:collapse}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@media(max-width:700px){.warehouse-grid{grid-template-columns:1fr}.warehouses h1{font-size:32px}}`}</style>
  </main>;
}
