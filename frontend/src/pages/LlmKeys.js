/* eslint-disable */
import React, { useEffect, useState } from "react";
import { Plus, Eye, EyeOff, Trash2, Pencil, KeyRound, Zap, CheckCircle2, XCircle } from "lucide-react";
import { apiClient, formatErr } from "../lib/api";
import { useToast } from "../lib/toast";

const PROVIDERS = [
  { value: "emergent", label: "Emergent Universal Key", hint: "Single key powers OpenAI, Anthropic, Gemini via Emergent." },
  { value: "openai", label: "OpenAI", hint: "GPT-5.2, GPT-4o, image gen, whisper, TTS." },
  { value: "groq", label: "Groq", hint: "Whisper STT (audio transcribe), ultra-fast inference." },
  { value: "anthropic", label: "Anthropic Claude", hint: "Claude Sonnet 4.5, Opus 4.5, Haiku 4.5." },
  { value: "gemini", label: "Google Gemini", hint: "Gemini 3 Pro, Gemini 3 Flash, Nano Banana." },
  { value: "custom", label: "Custom Provider", hint: "Any OpenAI-compatible endpoint (set base_url)." },
];

const empty = {
  provider: "emergent", label: "", api_key: "", model: "", base_url: "",
  balance: 0, is_active: true, notes: "",
};

export default function LlmKeys() {
  const [items, setItems] = useState([]);
  const [reveal, setReveal] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = async () => {
    const { data } = await apiClient.get("/llm-keys", { params: { reveal } });
    setItems(data.items || []);
  };

  useEffect(() => { load(); }, [reveal]);

  const openCreate = () => { setForm(empty); setEditing(null); setOpen(true); };
  const openEdit = (it) => {
    setEditing(it.id);
    setForm({
      provider: it.provider, label: it.label, api_key: reveal ? it.api_key : "",
      model: it.model || "", base_url: it.base_url || "",
      balance: it.balance || 0, is_active: !!it.is_active, notes: it.notes || "",
    });
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      if (editing) {
        const body = { ...form };
        if (!body.api_key) delete body.api_key; // don't overwrite if blank
        await apiClient.patch(`/llm-keys/${editing}`, body);
        toast.show("LLM key updated", "success");
      } else {
        await apiClient.post(`/llm-keys`, form);
        toast.show("LLM key added", "success");
      }
      setOpen(false); await load();
    } catch (e) { toast.show(formatErr(e), "error"); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this LLM key?")) return;
    try {
      await apiClient.delete(`/llm-keys/${id}`);
      toast.show("Deleted", "success");
      await load();
    } catch (e) { toast.show(formatErr(e), "error"); }
  };

  const testKey = async (id) => {
    try {
      const { data } = await apiClient.post(`/llm-keys/${id}/test`);
      toast.show(data.message, data.ok ? "success" : "error");
    } catch (e) { toast.show(formatErr(e), "error"); }
  };

  return (
    <div data-testid="llm-keys-page">
      <div className="callout" style={{marginBottom:18}}>
        <KeyRound size={18}/>
        <div>
          Manage every LLM provider key your app uses. <strong>⚠️ The Emergent Universal Key (sk-emergent-…) only works on the Emergent preview server</strong> — for your Hostinger deployment, add a real <strong>OpenAI</strong>, <strong>Anthropic</strong> or <strong>Google Gemini</strong> key. Voice features (mic / TTS) require an <strong>OpenAI</strong> key specifically.
        </div>
      </div>

      <div className="row between" style={{marginBottom:14}}>
        <div>
          <h2>LLM & API Keys</h2>
          <div className="muted" style={{marginTop:6,fontSize:14}}>{items.length} keys configured</div>
        </div>
        <div className="row" style={{gap:10}}>
          <button className="btn" onClick={() => setReveal(!reveal)} data-testid="toggle-reveal-keys">
            {reveal ? <><EyeOff size={14}/> Hide Keys</> : <><Eye size={14}/> Reveal Keys</>}
          </button>
          <button className="btn primary" onClick={openCreate} data-testid="add-llm-key-btn"><Plus size={14}/> Add Key</button>
        </div>
      </div>

      <div className="card">
        <table className="table" data-testid="llm-keys-table">
          <thead>
            <tr><th>Provider</th><th>Label</th><th>Model</th><th>API Key</th><th>Balance</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan="7"><div className="empty">No keys yet</div></td></tr>
            )}
            {items.map((it) => (
              <tr key={it.id} data-testid={`llm-row-${it.id}`}>
                <td><span className="tag">{it.provider}</span></td>
                <td><strong>{it.label}</strong></td>
                <td className="muted">{it.model || "—"}</td>
                <td style={{fontFamily:"monospace",fontSize:12}}>{it.api_key || <span className="dim">— not set —</span>}</td>
                <td>${(it.balance ?? 0).toFixed(2)}</td>
                <td>{it.is_active ? <span className="tag green"><CheckCircle2 size={11}/> Active</span> : <span className="tag red"><XCircle size={11}/> Inactive</span>}</td>
                <td>
                  <div className="row" style={{gap:6,justifyContent:"flex-end"}}>
                    <button className="btn sm" onClick={() => testKey(it.id)} data-testid={`test-key-${it.id}`}><Zap size={12}/> Test</button>
                    <button className="btn sm" onClick={() => openEdit(it)} data-testid={`edit-key-${it.id}`}><Pencil size={12}/></button>
                    <button className="btn sm danger" onClick={() => remove(it.id)} data-testid={`delete-key-${it.id}`}><Trash2 size={12}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} data-testid="llm-modal">
            <h3>{editing ? "Edit LLM Key" : "Add New LLM Key"}</h3>

            <label className="muted" style={{fontSize:12,fontWeight:600}}>PROVIDER</label>
            <select value={form.provider} onChange={(e) => setForm({...form, provider:e.target.value})} style={{margin:"8px 0 4px"}} data-testid="form-provider">
              {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <div className="dim" style={{fontSize:12,marginBottom:12}}>{PROVIDERS.find(p => p.value === form.provider)?.hint}</div>

            <label className="muted" style={{fontSize:12,fontWeight:600}}>LABEL</label>
            <input value={form.label} onChange={(e) => setForm({...form, label:e.target.value})} placeholder="e.g. Production Key" style={{margin:"8px 0 12px"}} data-testid="form-label"/>

            <label className="muted" style={{fontSize:12,fontWeight:600}}>API KEY {editing && <span className="dim">(leave blank to keep current)</span>}</label>
            <input value={form.api_key} onChange={(e) => setForm({...form, api_key:e.target.value})} placeholder="sk-..." style={{margin:"8px 0 12px",fontFamily:"monospace"}} data-testid="form-api-key"/>

            <div className="row" style={{gap:12}}>
              <div style={{flex:1}}>
                <label className="muted" style={{fontSize:12,fontWeight:600}}>MODEL</label>
                <input value={form.model} onChange={(e) => setForm({...form, model:e.target.value})} placeholder="gpt-4o-mini" style={{margin:"8px 0 12px"}} data-testid="form-model"/>
              </div>
              <div style={{flex:1}}>
                <label className="muted" style={{fontSize:12,fontWeight:600}}>BALANCE (USD)</label>
                <input type="number" step="0.01" value={form.balance} onChange={(e) => setForm({...form, balance:parseFloat(e.target.value)||0})} style={{margin:"8px 0 12px"}} data-testid="form-balance"/>
              </div>
            </div>

            {form.provider === "custom" && (
              <>
                <label className="muted" style={{fontSize:12,fontWeight:600}}>BASE URL</label>
                <input value={form.base_url} onChange={(e) => setForm({...form, base_url:e.target.value})} placeholder="https://api.example.com/v1" style={{margin:"8px 0 12px"}} data-testid="form-base-url"/>
              </>
            )}

            <label className="muted" style={{fontSize:12,fontWeight:600}}>NOTES</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({...form, notes:e.target.value})} placeholder="Internal notes…" style={{margin:"8px 0 12px"}} data-testid="form-notes"/>

            <div className="row between" style={{marginTop:8}}>
              <label className="row" style={{gap:10,cursor:"pointer"}}>
                <span className="switch">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({...form, is_active:e.target.checked})} data-testid="form-active"/>
                  <span className="slider"/>
                </span>
                <span className="muted" style={{fontSize:13}}>Active</span>
              </label>
              <div className="row" style={{gap:8}}>
                <button className="btn" onClick={() => setOpen(false)} data-testid="form-cancel">Cancel</button>
                <button className="btn primary" onClick={save} disabled={busy} data-testid="form-save">{busy ? <span className="spinner"/> : "Save Key"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
