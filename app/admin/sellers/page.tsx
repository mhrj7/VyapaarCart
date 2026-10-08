"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

type Seller = { id: number; displayName: string; status: string; requestedAt: string | null };
type Audit = { id: string; sellerId: number; adminId: number | null; action: string; previousStatus: string; nextStatus: string; createdAt: string };

export default function SellerApprovalsPage() {
  const { getToken } = useAuth();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [notice, setNotice] = useState("");

  const request = useCallback(async (init: RequestInit = {}) => {
    const token = await getToken();
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch("/api/admin/seller-approvals", { ...init, headers });
  }, [getToken]);

  const load = useCallback(async () => {
    const response = await request();
    const data = await response.json();
    if (response.ok) { setSellers(data.sellers); setAudits(data.audits); }
    else setNotice(data.error ?? "Could not load seller approvals.");
  }, [request]);
  useEffect(() => { void load(); }, [load]);

  async function decide(sellerId: number, decision: "approved" | "rejected") {
    const response = await request({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sellerId, decision }) });
    const data = await response.json();
    setNotice(response.ok ? `Seller ${decision}.` : data.error ?? "Could not save the decision.");
    if (response.ok) await load();
  }

  return <main className="admin-page"><header><Link href="/dashboard">← Seller workspace</Link><p>ADMINISTRATION</p><h1>Seller approvals</h1><span>Approve sellers before they can operate a store. Every decision is recorded.</span></header>{notice && <p className="notice">{notice}</p>}<section><h2>Pending requests</h2>{sellers.length === 0 ? <p>No seller approvals are waiting.</p> : sellers.map((seller) => <article key={seller.id}><div><b>{seller.displayName}</b><span>Requested {seller.requestedAt ? new Date(seller.requestedAt).toLocaleString() : "recently"}</span></div><div><button onClick={() => void decide(seller.id, "approved")}>Approve</button><button className="reject" onClick={() => void decide(seller.id, "rejected")}>Reject</button></div></article>)}</section><section><h2>Approval audit</h2>{audits.map((audit) => <article key={audit.id}><div><b>Seller #{audit.sellerId}</b><span>{audit.previousStatus} → {audit.nextStatus}</span></div><span>{new Date(audit.createdAt).toLocaleString()}</span></article>)}</section><style>{`.admin-page{min-height:100vh;background:#f8f7f1;color:#17251f;padding:0 5vw 70px}.admin-page header,.admin-page section,.admin-page>.notice{max-width:900px;margin-left:auto;margin-right:auto}.admin-page header{padding:70px 0 32px;border-bottom:1px solid #dfe2d9}.admin-page header a{color:#1f8a58;font-size:13px;font-weight:700;text-decoration:none}.admin-page header p{font:600 10px ui-monospace,monospace;letter-spacing:.13em;color:#1f8a58;margin:32px 0 8px}.admin-page h1{font-size:54px;letter-spacing:-3px;margin:0 0 12px}.admin-page header span,.admin-page section>p{color:#68746e}.admin-page section{margin-top:28px;background:#fff;border:1px solid #e4e5df;border-radius:18px;padding:24px}.admin-page h2{margin:0 0 16px;font-size:22px}.admin-page article{display:flex;align-items:center;justify-content:space-between;gap:18px;border-top:1px solid #edf0ea;padding:14px 0}.admin-page article>div{display:grid;gap:4px}.admin-page article span{font-size:12px;color:#68746e}.admin-page button{border:0;border-radius:9px;background:#17251f;color:#fff;padding:9px 12px;margin-left:8px;font-weight:700}.admin-page button.reject{background:#8d3b33}.admin-page>.notice{color:#1f8a58;font-size:13px;margin-top:20px}@media(max-width:620px){.admin-page{padding:0 20px 40px}.admin-page h1{font-size:40px}.admin-page article{align-items:flex-start;flex-direction:column}.admin-page button{margin-left:0;margin-right:8px}}`}</style></main>;
}
