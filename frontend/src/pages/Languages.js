import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { apiClient, formatErr } from "../lib/api";
import { useToast } from "../lib/toast";

export default function Languages() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code:"", name:"", flag:"", tts_voice:"alloy", is_active:true });
  const toast = useToast();

  const load = async () => {
    const { data } = await apiClient.get("/languages");
    setItems(data.items || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing) await apiClient.patch(`/languages/${editing}`, form);
      else await apiClient.post("/languages", form);
      toast.show("Saved"); setOpen(false); load();
    } catch (e) { toast.show(formatErr(e), "error"); }
  };

  const remove = async (code) => {
    if (!window.confirm("Delete language?")) return;
    await apiClient.delete(`/languages/${code}`); toast.show("Deleted"); load();
  };

  return (
    <div data-testid="languages-page">
      <div className="row between" style={{marginBottom:14}}>
        <h2>Languages ({items.length})</h2>
        <button className="btn primary" onClick={() => { setForm({code:"",name:"",flag:"",tts_voice:"alloy",is_active:true}); setEditing(null); setOpen(true);}} data-testid="add-language-btn"><Plus size={14}/> Add Language</button>
      </div>

      <div className="card">
        <table className="table" data-testid="languages-table">
          <thead><tr><th>Flag</th><th>Code</th><th>Name</th><th>TTS Voice</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map(l => (
              <tr key={l.code}>
                <td style={{fontSize:24}}>{l.flag}</td>
                <td><code>{l.code}</code></td>
                <td><strong>{l.name}</strong></td>
                <td className="muted">{l.tts_voice}</td>
                <td>{l.is_active ? <span className="tag green">Active</span> : <span className="tag">Disabled</span>}</td>
                <td>
                  <div className="row" style={{gap:6,justifyContent:"flex-end"}}>
                    <button className="btn sm" onClick={() => { setEditing(l.code); setForm(l); setOpen(true); }} data-testid={`edit-lang-${l.code}`}><Pencil size={12}/></button>
                    <button className="btn sm danger" onClick={() => remove(l.code)} data-testid={`delete-lang-${l.code}`}><Trash2 size={12}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? "Edit" : "Add"} Language</h3>
            <div className="row" style={{gap:12,marginTop:10}}>
              <div style={{flex:1}}><label className="muted" style={{fontSize:12,fontWeight:600}}>CODE</label><input value={form.code} onChange={(e)=>setForm({...form,code:e.target.value})} placeholder="ko" disabled={!!editing} style={{margin:"8px 0"}} data-testid="lang-code"/></div>
              <div style={{flex:1}}><label className="muted" style={{fontSize:12,fontWeight:600}}>FLAG</label><input value={form.flag} onChange={(e)=>setForm({...form,flag:e.target.value})} placeholder="🇰🇷" style={{margin:"8px 0"}} data-testid="lang-flag"/></div>
            </div>
            <label className="muted" style={{fontSize:12,fontWeight:600}}>NAME</label>
            <input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="Korean" style={{margin:"8px 0 12px"}} data-testid="lang-name"/>
            <label className="muted" style={{fontSize:12,fontWeight:600}}>TTS VOICE</label>
            <input value={form.tts_voice} onChange={(e)=>setForm({...form,tts_voice:e.target.value})} placeholder="nova" style={{margin:"8px 0 12px"}} data-testid="lang-voice"/>
            <label className="row" style={{gap:10}}>
              <span className="switch"><input type="checkbox" checked={form.is_active} onChange={(e)=>setForm({...form,is_active:e.target.checked})}/><span className="slider"/></span>
              <span className="muted">Active</span>
            </label>
            <div className="row" style={{justifyContent:"flex-end",gap:8,marginTop:16}}>
              <button className="btn" onClick={()=>setOpen(false)}>Cancel</button>
              <button className="btn primary" onClick={save} data-testid="lang-save">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
