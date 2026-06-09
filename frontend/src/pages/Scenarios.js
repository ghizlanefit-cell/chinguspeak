import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { apiClient, formatErr } from "../lib/api";
import { useToast } from "../lib/toast";

const blank = { title:"", description:"", language:"en", difficulty:"beginner", prompt:"", is_active:true, icon:"message" };

export default function Scenarios() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const toast = useToast();

  const load = async () => setItems((await apiClient.get("/scenarios")).data.items || []);
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing) await apiClient.patch(`/scenarios/${editing}`, form);
      else await apiClient.post("/scenarios", form);
      toast.show("Saved"); setOpen(false); load();
    } catch (e) { toast.show(formatErr(e), "error"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete scenario?")) return;
    await apiClient.delete(`/scenarios/${id}`); toast.show("Deleted"); load();
  };

  return (
    <div data-testid="scenarios-page">
      <div className="row between" style={{marginBottom:14}}>
        <h2>Scenarios ({items.length})</h2>
        <button className="btn primary" onClick={() => { setForm(blank); setEditing(null); setOpen(true); }} data-testid="add-scenario-btn"><Plus size={14}/> Add Scenario</button>
      </div>

      <div className="grid" style={{gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))"}}>
        {items.map(s => (
          <div key={s.id} className="card" data-testid={`scenario-${s.id}`}>
            <div className="row between">
              <span className="tag">{s.difficulty}</span>
              {s.is_active ? <span className="tag green">Active</span> : <span className="tag red">Off</span>}
            </div>
            <h3 style={{marginTop:14}}>{s.title}</h3>
            <div className="muted" style={{fontSize:13,marginTop:6}}>{s.description}</div>
            <div className="dim" style={{fontSize:12,marginTop:10}}>Lang: {s.language} · {s.uses_count || 0} uses</div>
            <div className="row" style={{gap:8,marginTop:14}}>
              <button className="btn sm" onClick={() => { setEditing(s.id); setForm(s); setOpen(true); }} data-testid={`edit-scenario-${s.id}`}><Pencil size={12}/> Edit</button>
              <button className="btn sm danger" onClick={() => remove(s.id)} data-testid={`delete-scenario-${s.id}`}><Trash2 size={12}/></button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? "Edit" : "Add"} Scenario</h3>
            <label className="muted" style={{fontSize:12,fontWeight:600}}>TITLE</label>
            <input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} placeholder="Order at a Cafe" style={{margin:"8px 0 12px"}} data-testid="scenario-title"/>
            <label className="muted" style={{fontSize:12,fontWeight:600}}>DESCRIPTION</label>
            <input value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} placeholder="Short summary" style={{margin:"8px 0 12px"}} data-testid="scenario-desc"/>
            <div className="row" style={{gap:12}}>
              <div style={{flex:1}}>
                <label className="muted" style={{fontSize:12,fontWeight:600}}>LANGUAGE</label>
                <input value={form.language} onChange={(e)=>setForm({...form,language:e.target.value})} placeholder="en" style={{margin:"8px 0 12px"}}/>
              </div>
              <div style={{flex:1}}>
                <label className="muted" style={{fontSize:12,fontWeight:600}}>DIFFICULTY</label>
                <select value={form.difficulty} onChange={(e)=>setForm({...form,difficulty:e.target.value})} style={{margin:"8px 0 12px"}}>
                  <option>beginner</option><option>intermediate</option><option>advanced</option>
                </select>
              </div>
            </div>
            <label className="muted" style={{fontSize:12,fontWeight:600}}>AI PROMPT</label>
            <textarea rows={3} value={form.prompt} onChange={(e)=>setForm({...form,prompt:e.target.value})} placeholder="System prompt for the AI to roleplay…" style={{margin:"8px 0 12px"}} data-testid="scenario-prompt"/>
            <label className="row" style={{gap:10}}>
              <span className="switch"><input type="checkbox" checked={form.is_active} onChange={(e)=>setForm({...form,is_active:e.target.checked})}/><span className="slider"/></span>
              <span className="muted">Active</span>
            </label>
            <div className="row" style={{justifyContent:"flex-end",gap:8,marginTop:16}}>
              <button className="btn" onClick={()=>setOpen(false)}>Cancel</button>
              <button className="btn primary" onClick={save} data-testid="scenario-save">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
