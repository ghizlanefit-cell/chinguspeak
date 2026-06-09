import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { apiClient, formatErr } from "../lib/api";
import { useToast } from "../lib/toast";

export default function Settings() {
  const [items, setItems] = useState([]);
  const toast = useToast();

  const load = async () => setItems((await apiClient.get("/settings")).data.items || []);
  useEffect(() => { load(); }, []);

  const save = async (s) => {
    try {
      await apiClient.put(`/settings/${s.key}`, { key: s.key, value: s.value, category: s.category, description: s.description });
      toast.show(`${s.key} saved`);
    } catch (e) { toast.show(formatErr(e), "error"); }
  };

  const update = (idx, val) => {
    setItems((arr) => arr.map((s, i) => i === idx ? { ...s, value: val } : s));
  };

  const grouped = items.reduce((acc, s) => {
    (acc[s.category || "general"] ||= []).push(s); return acc;
  }, {});

  return (
    <div data-testid="settings-page">
      <h2 style={{marginBottom:14}}>App Settings</h2>
      <div className="grid" style={{gridTemplateColumns:"repeat(auto-fill, minmax(380px, 1fr))"}}>
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat} className="card">
            <div className="section-head"><h3 style={{textTransform:"capitalize"}}>{cat}</h3><span className="tag">{list.length}</span></div>
            {list.map((s) => {
              const idx = items.indexOf(s);
              const isBool = typeof s.value === "boolean";
              const isNumber = typeof s.value === "number";
              return (
                <div key={s.key} style={{padding:"12px 0",borderTop:"1px solid var(--border)"}}>
                  <div className="row between" style={{marginBottom:6}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:14}}>{s.key}</div>
                      <div className="dim" style={{fontSize:11}}>{s.description}</div>
                    </div>
                    <button className="btn sm primary" onClick={() => save(items[idx])} data-testid={`save-${s.key}`}><Save size={12}/> Save</button>
                  </div>
                  {isBool ? (
                    <label className="row" style={{gap:10,marginTop:6}}>
                      <span className="switch"><input type="checkbox" checked={!!s.value} onChange={(e) => update(idx, e.target.checked)} data-testid={`setting-${s.key}`}/><span className="slider"/></span>
                      <span className="muted">{s.value ? "Enabled" : "Disabled"}</span>
                    </label>
                  ) : (
                    <input
                      type={isNumber ? "number" : "text"}
                      step={isNumber ? "any" : undefined}
                      value={s.value}
                      onChange={(e) => update(idx, isNumber ? parseFloat(e.target.value) : e.target.value)}
                      data-testid={`setting-${s.key}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
