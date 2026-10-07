"use client";

import Link from "next/link";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

type Profile = { contactName: string; email: string; phone: string; address: string; city: string; state: string; pincode: string };
const empty: Profile = { contactName: "", email: "", phone: "", address: "", city: "", state: "", pincode: "" };

export default function ShippingPage() {
  const { isSignedIn, getToken } = useAuth();
  const [profile, setProfile] = useState<Profile>(empty);
  const [notice, setNotice] = useState("");
  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = await getToken();
    return fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  }, [getToken]);
  useEffect(() => { if (isSignedIn) void request("/api/me/shipping-profile").then((r) => r.json()).then((data) => data.profile && setProfile(data.profile)); }, [isSignedIn, request]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const response = await request("/api/me/shipping-profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
    const data = await response.json();
    setNotice(response.ok ? "Pickup address saved. You can now create Shiprocket sandbox shipments for paid orders." : data.error || "Could not save your pickup address.");
  }
  if (!isSignedIn) return <main className="shipping"><section className="gate"><p>SHIPPING SETUP</p><h1>Set up your<br /><em>pickup address.</em></h1><span>Sign in as a seller to prepare Shiprocket sandbox shipping.</span><SignInButton><button>Sign in to continue</button></SignInButton><Link href="/">← Marketplace</Link></section><Style /></main>;
  return <main className="shipping"><Style /><header><Link href="/" className="logo">V<span>yapaar</span>Cart</Link><Link href="/dashboard">My listings →</Link></header><section className="intro"><p>SHIPROCKET SANDBOX</p><h1>Your pickup<br /><em>address.</em></h1><span>This is used only when you explicitly create a test shipment. It is saved securely with your seller profile.</span></section><form onSubmit={save} className="card"><div className="field"><label>Contact name<input required value={profile.contactName} onChange={(e) => setProfile({ ...profile, contactName: e.target.value })} /></label><label>Email<input required type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></label></div><div className="field"><label>Phone<input required inputMode="numeric" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label><label>Pincode<input required inputMode="numeric" maxLength={6} value={profile.pincode} onChange={(e) => setProfile({ ...profile, pincode: e.target.value.replace(/\D/g, "") })} /></label></div><label>Pickup address<textarea required value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} placeholder="Flat/building, street, locality" /></label><div className="field"><label>City<input required value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} /></label><label>State<input required value={profile.state} onChange={(e) => setProfile({ ...profile, state: e.target.value })} /></label></div><button>Save pickup address →</button>{notice && <p className="notice">{notice}</p>}</form></main>;
}

function Style() { return <style>{`.shipping{min-height:100vh;background:#f8f7f1;color:#17251f;padding:0 5vw 70px}.shipping header{height:82px;border-bottom:1px solid #dfe2d9;max-width:820px;margin:auto;display:flex;justify-content:space-between;align-items:center}.shipping a{color:#1f8a58;text-decoration:none;font-size:13px;font-weight:700}.logo{color:#17251f!important;font-size:21px!important;letter-spacing:-1px}.logo span{color:#1f8a58}.intro,.card{max-width:620px;margin:auto}.intro{padding:78px 0 32px}.intro p,.gate p{font:700 10px ui-monospace,monospace;color:#1f8a58;letter-spacing:.13em;margin:0 0 11px}.intro h1,.gate h1{font-size:58px;line-height:.88;letter-spacing:-3px;margin:0 0 16px}.intro h1 em,.gate h1 em{font-family:Georgia,serif;font-weight:400}.intro span,.gate span{color:#68746e;font-size:14px;line-height:1.55;display:block;max-width:480px}.card{background:#fff;border:1px solid #e1e5dc;border-radius:16px;padding:27px;display:grid;gap:14px}.card label{display:grid;gap:7px;font-size:12px;font-weight:700}.field{display:grid;grid-template-columns:1fr 1fr;gap:13px}.card input,.card textarea{border:1px solid #d8ddd6;border-radius:9px;padding:11px 12px;font:inherit;font-size:13px}.card textarea{min-height:86px;resize:vertical}.card button,.gate button{border:0;border-radius:9px;background:#17251f;color:#fff;padding:12px 15px;font-size:12px;font-weight:700}.notice{color:#1f8a58;font-size:12px;margin:0}.gate{max-width:620px;text-align:center;margin:auto;padding:150px 0}.gate span{margin:0 auto 24px}.gate>a{display:block;margin-top:22px}@media(max-width:650px){.shipping{padding:0 20px 40px}.shipping header{height:65px}.intro{padding-top:52px}.intro h1,.gate h1{font-size:45px}.field{grid-template-columns:1fr}.card{padding:20px}}`}</style>; }
