"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

type TeamMember = { id: number; displayName: string; role: "owner" | "manager" | "member" };

export function TeamMembers({ organizationId }: { organizationId: string }) {
  const { getToken } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "manager">("member");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const request = useCallback(async (init: RequestInit = {}) => {
    const token = await getToken();
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`/api/organizations/${organizationId}/members`, { ...init, headers });
  }, [getToken, organizationId]);

  const loadMembers = useCallback(async () => {
    const response = await request();
    const data = await response.json();
    if (response.ok) setMembers(data.members ?? []);
  }, [request]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const response = await request({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEmail("");
      setNotice("Staff access granted.");
      await loadMembers();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not invite this teammate.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="team-members"><p className="label">TEAM ACCESS</p><h3>Invite staff</h3><p>Invite a teammate who has already signed in to VyapaarCart. They receive seller-staff access for this organization.</p><form onSubmit={invite}><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@example.com" /><select value={role} onChange={(event) => setRole(event.target.value as "member" | "manager")}><option value="member">Staff member</option><option value="manager">Team manager</option></select><button disabled={busy} type="submit">{busy ? "Inviting…" : "Invite staff"}</button></form>{members.length > 0 && <div className="team-list">{members.map((member) => <span key={member.id}><b>{member.displayName}</b><em>{member.role}</em></span>)}</div>}{notice && <p className="notice">{notice}</p>}</section>;
}
