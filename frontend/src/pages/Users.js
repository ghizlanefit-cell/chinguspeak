import React, { useEffect, useState } from "react";
import { Search, Crown, Ban, Trash2, CheckCircle2 } from "lucide-react";
import { apiClient, formatErr } from "../lib/api";
import { useToast } from "../lib/toast";

export default function Users() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const toast = useToast();

  const load = async () => {
    const { data } = await apiClient.get("/users", { params: q ? { q } : {} });
    setItems(data.items || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const togglePro = async (u) => {
    try { await apiClient.patch(`/users/${u.id}`, { is_pro: !u.is_pro }); toast.show(`${u.email} → ${!u.is_pro ? "Pro" : "Free"}`); load(); }
    catch (e) { toast.show(formatErr(e), "error"); }
  };
  const toggleBan = async (u) => {
    try { await apiClient.patch(`/users/${u.id}`, { is_banned: !u.is_banned }); toast.show(`${u.email} ${u.is_banned ? "unbanned" : "banned"}`); load(); }
    catch (e) { toast.show(formatErr(e), "error"); }
  };
  const remove = async (u) => {
    if (!window.confirm(`Delete ${u.email}?`)) return;
    await apiClient.delete(`/users/${u.id}`);
    toast.show("User deleted");
    load();
  };

  return (
    <div data-testid="users-page">
      <div className="row between" style={{marginBottom:14}}>
        <div>
          <h2>Users</h2>
          <div className="muted" style={{marginTop:6,fontSize:14}}>{items.length} users total</div>
        </div>
        <div className="search-wrap" style={{maxWidth:340}}>
          <Search size={16}/>
          <input
            value={q}
            placeholder="Search by name or email…"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            data-testid="users-search"
          />
        </div>
      </div>

      <div className="card">
        <table className="table" data-testid="users-table">
          <thead><tr><th>User</th><th>Email</th><th>Plan</th><th>Conversations</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={6}><div className="empty">No users</div></td></tr>}
            {items.map(u => (
              <tr key={u.id} data-testid={`user-row-${u.id}`}>
                <td>
                  <div className="row" style={{gap:10}}>
                    <div className="avatar" style={{width:36,height:36,fontSize:14}}>{(u.name||"U").slice(0,1)}</div>
                    <div>
                      <div style={{fontWeight:600}}>{u.name} {u.country_flag}</div>
                      <div className="dim" style={{fontSize:11}}>Joined {(u.created_at||"").slice(0,10)}</div>
                    </div>
                  </div>
                </td>
                <td className="muted">{u.email}</td>
                <td>{u.is_pro ? <span className="tag yellow"><Crown size={11}/> Pro</span> : <span className="tag">Free</span>}</td>
                <td>{(u.conversations_count||0).toLocaleString()}</td>
                <td>{u.is_banned ? <span className="tag red">Banned</span> : <span className="tag green"><CheckCircle2 size={11}/> Active</span>}</td>
                <td>
                  <div className="row" style={{gap:6,justifyContent:"flex-end"}}>
                    <button className="btn sm" onClick={() => togglePro(u)} data-testid={`toggle-pro-${u.id}`}><Crown size={12}/> {u.is_pro?"Make Free":"Make Pro"}</button>
                    <button className="btn sm" onClick={() => toggleBan(u)} data-testid={`toggle-ban-${u.id}`}><Ban size={12}/> {u.is_banned?"Unban":"Ban"}</button>
                    <button className="btn sm danger" onClick={() => remove(u)} data-testid={`delete-user-${u.id}`}><Trash2 size={12}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
