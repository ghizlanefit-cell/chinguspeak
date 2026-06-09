import React, { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, ShieldCheck } from "lucide-react";
import { apiClient, formatErr } from "../lib/api";
import { useToast } from "../lib/toast";
import { useAuth } from "../lib/auth";

export default function Admins() {
  const { admin } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email:"", password:"" });
  const toast = useToast();

  const load = async () => setItems((await apiClient.get("/admins")).data.items || []);
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await apiClient.post("/admins", form);
      toast.show("Admin created"); setOpen(false); load();
    } catch (e) { toast.show(formatErr(e), "error"); }
  };
  const remove = async (a) => {
    if (!window.confirm("Delete admin "+a.email+"?")) return;
    try { await apiClient.delete(`/admins/${a.id}`); toast.show("Removed"); load(); }
    catch (e) { toast.show(formatErr(e), "error"); }
  };

  return (
    <div data-testid="admins-page">
      <div className="row between" style={{marginBottom:14}}>
        <div><h2>Admin Users</h2><div className="muted" style={{marginTop:6,fontSize:14}}>{items.length} admin accounts</div></div>
        <button className="btn primary" onClick={() => { setForm({email:"",password:""}); setOpen(true); }} data-testid="add-admin-btn"><Plus size={14}/> Add Admin</button>
      </div>
      <div className="card">
        <table className="table" data-testid="admins-table">
          <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {items.map(a => (
              <tr key={a.id}>
                <td><strong>{a.email}</strong></td>
                <td className="muted">{a.name || "—"}</td>
                <td><span className="tag"><ShieldCheck size={11}/> {a.role}</span></td>
                <td className="muted">{(a.created_at||"").slice(0,10)}</td>
                <td style={{textAlign:"right"}}>
                  <button className="btn sm danger" disabled={a.id === admin?.id} onClick={() => remove(a)} data-testid={`delete-admin-${a.id}`}><Trash2 size={12}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Admin</h3>
            <label className="muted" style={{fontSize:12,fontWeight:600}}>EMAIL</label>
            <input value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} placeholder="newadmin@chinguspeak.com" style={{margin:"8px 0 12px"}} data-testid="new-admin-email"/>
            <label className="muted" style={{fontSize:12,fontWeight:600}}>PASSWORD</label>
            <input type="password" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} placeholder="strong password" style={{margin:"8px 0 12px"}} data-testid="new-admin-password"/>
            <div className="row" style={{justifyContent:"flex-end",gap:8,marginTop:14}}>
              <button className="btn" onClick={()=>setOpen(false)}>Cancel</button>
              <button className="btn primary" onClick={save} data-testid="new-admin-save">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
