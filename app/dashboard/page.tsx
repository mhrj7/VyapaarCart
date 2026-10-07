"use client";

import Link from "next/link";
import { SignInButton, useAuth, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

type Listing = {
  id: string; title: string; description: string; category: string; price: number; city: string;
  conditionLabel: string; status: "active" | "sold" | "archived"; imageUrl: string | null;
};

const initialForm = { title: "", description: "", category: "Electronics", price: "", city: "Bengaluru", conditionLabel: "Good" };

export default function SellerDashboard() {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [items, setItems] = useState<Listing[]>([]);
  const [form, setForm] = useState(initialForm);
  const [image, setImage] = useState<File | null>(null);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = await getToken();
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(path, { ...init, headers });
  }, [getToken]);

  const loadListings = useCallback(async () => {
    if (!isSignedIn) return;
    const response = await request("/api/me/listings");
    const data = await response.json();
    if (response.ok) setItems(data.listings);
  }, [isSignedIn, request]);

  useEffect(() => { void loadListings(); }, [loadListings]);

  async function createListing(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      let imageKey: string | undefined;
      if (image) {
        const upload = new FormData();
        upload.append("image", image);
        const uploadResponse = await request("/api/uploads", { method: "POST", body: upload });
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadData.error);
        imageKey = uploadData.imageKey;
      }
      const response = await request("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, price: Number(form.price), imageKey }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setItems((current) => [data.listing, ...current]);
      setForm(initialForm);
      setImage(null);
      setNotice("Your listing is live.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not publish the listing.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      const response = await request(`/api/listings/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setItems((current) => current.map((item) => item.id === editing.id ? data.listing : item));
      setEditing(null);
      setNotice("Listing updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update the listing.");
    } finally {
      setBusy(false);
    }
  }

  async function removeListing(id: string) {
    if (!window.confirm("Delete this listing permanently?")) return;
    const response = await request(`/api/listings/${id}`, { method: "DELETE" });
    if (response.ok) {
      setItems((current) => current.filter((item) => item.id !== id));
      setNotice("Listing deleted.");
    } else setNotice("Could not delete that listing.");
  }

  if (!isSignedIn) return <main className="seller-page"><section className="seller-hero"><p className="label">VYAPAARCART SELLER</p><h1>Manage your listings<br />in one place.</h1><p>Sign in to publish items, update prices, and manage your local marketplace presence.</p><SignInButton><button className="seller-primary">Sign in to continue</button></SignInButton><Link href="/" className="seller-back">← Back to marketplace</Link></section><DashboardStyles /></main>;

  return <main className="seller-page"><DashboardStyles /><header className="seller-nav"><a href="/" className="seller-logo">V<span>yapaar</span>Cart</a><div><span className="seller-name">Hi, {user?.firstName || "seller"}</span><a href="/shipping" className="seller-back">Shipping setup</a><a href="/" className="seller-back">Marketplace →</a></div></header><section className="seller-intro"><p className="label">SELLER WORKSPACE</p><h1>Run your local shop<br /><em>without the clutter.</em></h1><p>Create a real listing, upload its photo, then update, mark sold, or remove it whenever you need.</p></section><section className="seller-grid"><form className="panel create-panel" onSubmit={createListing}><div className="panel-heading"><div><p className="label">NEW LISTING</p><h2>List an item</h2></div><span>01</span></div><label>Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Teak wood study desk" /></label><label>Description<textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe condition, accessories and pickup details." /></label><div className="fields"><label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>Electronics</option><option>Mobiles</option><option>Furniture</option><option>Bikes</option><option>Fashion</option></select></label><label>Condition<select value={form.conditionLabel} onChange={(e) => setForm({ ...form, conditionLabel: e.target.value })}><option>Like new</option><option>Good</option><option>Fair</option></select></label></div><div className="fields"><label>Price (₹)<input required min="1" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" /></label><label>City<input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label></div><label>Photo <small>JPG, PNG or WebP · max 5 MB</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImage(e.target.files?.[0] || null)} /></label><button disabled={busy} className="seller-primary">{busy ? "Publishing…" : "Publish listing →"}</button>{notice && <p className="notice">{notice}</p>}</form><section className="panel listings-panel"><div className="panel-heading"><div><p className="label">YOUR INVENTORY</p><h2>My listings</h2></div><span>{items.length}</span></div>{items.length === 0 ? <div className="empty"><b>Your shop is ready.</b><p>Create your first real listing using the form.</p></div> : <div className="my-listings">{items.map((item) => <article className="my-listing" key={item.id}>{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <div className="image-placeholder">✦</div>}<div className="listing-copy"><div className="listing-top"><b>{item.title}</b><span className={`status ${item.status}`}>{item.status}</span></div><p>₹{item.price.toLocaleString("en-IN")} · {item.city}</p><div className="listing-actions"><button onClick={() => setEditing(item)}>Edit</button><button onClick={() => void request(`/api/listings/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: item.status === "sold" ? "active" : "sold" }) }).then(loadListings)}>{item.status === "sold" ? "Relist" : "Mark sold"}</button><button className="delete" onClick={() => void removeListing(item.id)}>Delete</button></div></div></article>)}</div>}</section></section>{editing && <div className="edit-layer"><form className="edit-card" onSubmit={saveEdit}><button type="button" className="close-edit" onClick={() => setEditing(null)}>×</button><p className="label">EDIT LISTING</p><h2>Keep it current.</h2><label>Title<input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></label><label>Description<textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></label><div className="fields"><label>Price (₹)<input type="number" min="1" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></label><label>City<input value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></label></div><label>Status<select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as Listing["status"] })}><option value="active">Active</option><option value="sold">Sold</option><option value="archived">Archived</option></select></label><button disabled={busy} className="seller-primary">Save changes</button></form></div>}</main>;
}

function DashboardStyles() {
  return <style>{`
    .seller-page{min-height:100vh;background:#f8f7f1;color:#17251f;padding:0 5vw 70px}.seller-nav{max-width:1180px;margin:auto;height:82px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #dfe2d9}.seller-logo{color:#17251f;font-size:21px;font-weight:800;text-decoration:none;letter-spacing:-1px}.seller-logo:first-letter{color:#1f8a58}.seller-logo span{color:#1f8a58}.seller-nav>div{display:flex;gap:20px;align-items:center}.seller-name{font-size:13px;color:#68746e}.seller-back{font-size:13px;font-weight:700;color:#1f8a58;text-decoration:none}.seller-hero,.seller-intro{max-width:1180px;margin:0 auto;padding:90px 0 58px}.seller-hero{max-width:700px;text-align:center}.seller-hero h1,.seller-intro h1{font-size:clamp(42px,6vw,75px);line-height:.9;letter-spacing:-4px;margin:12px 0 20px}.seller-intro h1 em{font-family:Georgia,serif;font-weight:400}.seller-hero>p:not(.label),.seller-intro>p:not(.label){max-width:570px;color:#66736b;line-height:1.55;font-size:16px}.seller-hero>p:not(.label){margin:0 auto 26px}.label{font:600 10px ui-monospace,SFMono-Regular,monospace;letter-spacing:.13em;color:#1f8a58}.seller-primary{border:0;border-radius:10px;background:#17251f;color:white;padding:13px 18px;font-size:13px;font-weight:700}.seller-primary:disabled{opacity:.6}.seller-hero .seller-back{display:block;margin-top:22px}.seller-grid{max-width:1180px;margin:auto;display:grid;grid-template-columns:minmax(310px,.82fr) 1.18fr;gap:24px;align-items:start}.panel{background:white;border:1px solid #e4e5df;border-radius:18px;padding:28px;box-shadow:0 8px 22px rgba(31,53,41,.04)}.panel-heading{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}.panel-heading h2{font-size:27px;letter-spacing:-1.3px;margin:5px 0 0}.panel-heading>span{height:31px;min-width:31px;display:grid;place-items:center;border-radius:50%;background:#d9fa6a;font:700 12px ui-monospace,monospace}.panel label{display:grid;gap:7px;font-size:12px;font-weight:700;margin:13px 0}.panel label small{font-weight:400;color:#76827b}.panel input,.panel textarea,.panel select,.edit-card input,.edit-card textarea,.edit-card select{border:1px solid #d8ddd6;border-radius:9px;background:#fff;padding:11px 12px;font:inherit;font-size:13px;color:#17251f}.panel textarea,.edit-card textarea{min-height:92px;resize:vertical}.fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}.create-panel .seller-primary{width:100%;margin-top:11px}.notice{font-size:12px;color:#1f8a58;margin:13px 0 0}.empty{min-height:260px;display:grid;place-content:center;text-align:center;color:#718078}.empty b{color:#17251f}.empty p{font-size:13px}.my-listings{display:grid;gap:12px}.my-listing{display:grid;grid-template-columns:95px 1fr;gap:15px;border-top:1px solid #edf0ea;padding-top:13px}.my-listing img,.image-placeholder{width:95px;height:80px;object-fit:cover;border-radius:10px;background:#e8eee1}.image-placeholder{display:grid;place-items:center;color:#1f8a58;font-size:24px}.listing-top{display:flex;gap:10px;align-items:flex-start;justify-content:space-between}.listing-top b{font-size:13px;line-height:1.3}.listing-copy p{font-size:12px;color:#68746e;margin:5px 0 10px}.status{font:700 10px ui-monospace,monospace;text-transform:uppercase;border-radius:20px;padding:4px 7px;background:#ecf5eb;color:#1f8a58}.status.sold{background:#f6e8dc;color:#a75d21}.status.archived{background:#ececea;color:#6d736e}.listing-actions{display:flex;gap:14px}.listing-actions button{border:0;background:none;padding:0;color:#1f8a58;font-size:11px;font-weight:700}.listing-actions .delete{color:#bd5341}.edit-layer{position:fixed;inset:0;z-index:20;background:rgba(16,31,23,.45);display:grid;place-items:center;padding:20px}.edit-card{position:relative;width:min(520px,100%);background:#fffdf9;padding:31px;border-radius:18px;box-shadow:0 25px 55px rgba(0,0,0,.22)}.edit-card h2{font-size:29px;letter-spacing:-1.3px;margin:4px 0 18px}.edit-card label{display:grid;gap:7px;font-size:12px;font-weight:700;margin:13px 0}.edit-card .seller-primary{width:100%;margin-top:12px}.close-edit{position:absolute;right:17px;top:15px;border:0;background:none;font-size:24px}@media(max-width:800px){.seller-page{padding:0 20px 45px}.seller-grid{grid-template-columns:1fr}.seller-intro{padding:56px 0 35px}.seller-nav{height:65px}.seller-name{display:none}.seller-hero h1,.seller-intro h1{letter-spacing:-2.5px}.panel{padding:21px}.fields{grid-template-columns:1fr}.my-listing{grid-template-columns:72px 1fr}.my-listing img,.image-placeholder{width:72px;height:72px}}`}</style>;
}
