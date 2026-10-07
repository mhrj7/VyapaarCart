"use client";

import Link from "next/link";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

type Conversation = { conversation: { id: string }; listingTitle: string };
type Message = { id: string; body: string; createdAt: string };

export default function InboxPage() {
  const { isSignedIn, getToken } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = await getToken();
    return fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  }, [getToken]);

  useEffect(() => {
    if (!isSignedIn) return;
    void request("/api/conversations").then(async (response) => {
      const data = await response.json();
      if (response.ok) { setConversations(data.conversations); setActive(data.conversations[0] || null); }
    });
  }, [isSignedIn, request]);

  useEffect(() => {
    if (!active) { setMessages([]); return; }
    void request(`/api/conversations/${active.conversation.id}/messages`).then(async (response) => {
      const data = await response.json();
      if (response.ok) setMessages(data.messages);
    });
  }, [active, request]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!active || !draft.trim()) return;
    const response = await request(`/api/conversations/${active.conversation.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: draft }) });
    const data = await response.json();
    if (response.ok) { setMessages((current) => [...current, data.message]); setDraft(""); }
  }

  if (!isSignedIn) return <main className="inbox"><Style /><section className="gate"><p>VYAPAARCART INBOX</p><h1>Real conversations,<br /><em>kept simple.</em></h1><span>Sign in to contact sellers and keep your deals in one safe place.</span><SignInButton><button>Sign in to open inbox</button></SignInButton><Link href="/">← Back to marketplace</Link></section></main>;

  return <main className="inbox"><Style /><header><Link href="/" className="logo">V<span>yapaar</span>Cart</Link><Link href="/dashboard">My listings →</Link></header><section className="headline"><p>MESSAGES</p><h1>Your inbox</h1><span>Every chat is linked to a marketplace listing.</span></section><section className="frame"><aside><b>Conversations</b>{conversations.length ? conversations.map((item) => <button key={item.conversation.id} className={active?.conversation.id === item.conversation.id ? "thread selected" : "thread"} onClick={() => setActive(item)}><i>✦</i><span>{item.listingTitle}<small>Marketplace conversation</small></span></button>) : <div className="empty">Open a listing and press Chat to start your first conversation.</div>}</aside><section className="chat">{active ? <><div className="chat-head"><p>ABOUT THE LISTING</p><h2>{active.listingTitle}</h2></div><div className="message-list">{messages.length ? messages.map((message) => <div className="bubble" key={message.id}>{message.body}<small>{new Date(message.createdAt).toLocaleString()}</small></div>) : <div className="empty">Say hello and ask the seller a question.</div>}</div><form onSubmit={send}><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} placeholder="Write a message…" /><button>Send</button></form></> : <div className="empty">Choose a conversation to read or reply.</div>}</section></section></main>;
}

function Style() { return <style>{`
  .inbox{min-height:100vh;background:#f8f7f1;color:#17251f;padding:0 5vw 60px}.inbox header{height:82px;border-bottom:1px solid #dfe2d9;max-width:1120px;margin:auto;display:flex;align-items:center;justify-content:space-between}.inbox a{color:#1f8a58;text-decoration:none;font-size:13px;font-weight:700}.logo{color:#17251f!important;font-size:21px!important;letter-spacing:-1px}.logo span{color:#1f8a58}.headline{max-width:1120px;margin:auto;padding:60px 0 34px}.headline p,.chat-head p,.gate p{font:600 10px ui-monospace,monospace;letter-spacing:.13em;color:#1f8a58;margin:0 0 10px}.headline h1,.gate h1{font-size:54px;line-height:.9;letter-spacing:-2.8px;margin:0 0 14px}.headline>span,.gate>span{color:#68746e;font-size:14px}.frame{max-width:1120px;margin:auto;display:grid;grid-template-columns:320px 1fr;min-height:530px;border:1px solid #e3e5de;border-radius:18px;overflow:hidden;background:#fff}.frame aside{padding:22px;border-right:1px solid #e3e5de}.frame aside>b{font-size:13px}.thread{width:100%;display:flex;gap:11px;text-align:left;border:0;background:none;border-radius:10px;padding:12px 9px;margin:10px 0;color:#17251f}.thread:hover,.thread.selected{background:#eef6e6}.thread i{width:28px;height:28px;display:grid;place-items:center;background:#d9fa6a;border-radius:9px;font-style:normal}.thread>span{display:grid;gap:4px;font-size:12px;font-weight:700}.thread small{color:#77817b;font-size:10px;font-weight:400}.chat{display:flex;flex-direction:column;min-width:0}.chat-head{padding:22px 27px;border-bottom:1px solid #e3e5de}.chat-head h2{font-size:21px;margin:0;letter-spacing:-.7px}.message-list{flex:1;min-height:335px;padding:25px 27px;display:grid;align-content:start;gap:12px}.bubble{width:fit-content;max-width:78%;background:#edf5e9;border-radius:13px 13px 13px 2px;padding:11px 13px;font-size:13px;line-height:1.45}.bubble small{display:block;color:#78817b;font-size:9px;margin-top:5px}.chat form{display:grid;grid-template-columns:1fr auto;gap:10px;padding:17px 22px;border-top:1px solid #e3e5de}.chat input{border:1px solid #d7dcd5;border-radius:9px;padding:11px 12px;font:inherit;font-size:13px}.chat button,.gate button{border:0;border-radius:9px;padding:11px 17px;background:#17251f;color:#fff;font-size:12px;font-weight:700}.empty{display:grid;place-content:center;color:#77817b;font-size:12px;line-height:1.5;text-align:center;min-height:120px}.gate{max-width:620px;margin:auto;text-align:center;padding:135px 0}.gate h1 em{font-family:Georgia,serif;font-weight:400}.gate>span{display:block;line-height:1.5;margin:0 auto 23px}.gate>a{display:block;margin-top:20px}@media(max-width:720px){.inbox{padding:0 20px 30px}.frame{grid-template-columns:1fr}.frame aside{border-right:0;border-bottom:1px solid #e3e5de}.headline{padding:42px 0 25px}.headline h1,.gate h1{font-size:43px;letter-spacing:-2px}.chat{min-height:420px}}`}</style>; }
