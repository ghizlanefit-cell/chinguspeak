import React, { useState } from "react";
import { Smartphone, Tablet, Monitor, ExternalLink, RefreshCw } from "lucide-react";

const DEVICES = [
  { id: "phone", label: "Phone", icon: Smartphone, w: 375, h: 780 },
  { id: "tablet", label: "Tablet", icon: Tablet, w: 768, h: 900 },
  { id: "desktop", label: "Desktop", icon: Monitor, w: 1280, h: 720 },
];

export default function MobilePreview() {
  const [device, setDevice] = useState("phone");
  const [reloadKey, setReloadKey] = useState(0);
  const cur = DEVICES.find((d) => d.id === device);

  return (
    <div data-testid="mobile-preview-page">
      <div className="row between" style={{marginBottom:14}}>
        <div>
          <h2>📱 Mobile App Live Preview</h2>
          <div className="muted" style={{marginTop:6,fontSize:14}}>
            Live build of ChinguSpeak — every API call goes to <code>/api/*</code> on this same backend.
          </div>
        </div>
        <div className="row" style={{gap:8}}>
          {DEVICES.map((d) => (
            <button
              key={d.id}
              className={`btn sm ${device === d.id ? "primary" : ""}`}
              onClick={() => setDevice(d.id)}
              data-testid={`device-${d.id}`}
            >
              <d.icon size={14} /> {d.label}
            </button>
          ))}
          <button className="btn sm" onClick={() => setReloadKey(reloadKey + 1)} data-testid="reload-mobile">
            <RefreshCw size={14}/> Reload
          </button>
          <a className="btn sm" href="/mobile/" target="_blank" rel="noopener" data-testid="open-mobile-fullscreen">
            <ExternalLink size={14}/> Open Full
          </a>
        </div>
      </div>

      <div className="callout" style={{marginBottom:18}}>
        <Smartphone size={18}/>
        <div>
          <strong>Connected to your live admin backend.</strong> Any LLM key, scenario, language or user change you make in the admin will be reflected here instantly — just hit Reload after changes.
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"center",padding:"12px 0"}}>
        <div style={{
          width: cur.w + 24,
          maxWidth: "100%",
          padding: 12,
          borderRadius: device === "phone" ? 40 : 24,
          background: "linear-gradient(180deg,#1B0C32,#0E0420)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}>
          <iframe
            key={reloadKey}
            src="/mobile/"
            title="ChinguSpeak Mobile Preview"
            data-testid="mobile-iframe"
            style={{
              width: cur.w,
              height: cur.h,
              maxWidth: "100%",
              border: "none",
              borderRadius: device === "phone" ? 32 : 18,
              background: "#000",
              display: "block",
            }}
            allow="microphone; camera; clipboard-read; clipboard-write"
          />
        </div>
      </div>

      <div className="card" style={{marginTop:20}}>
        <h3>How the link works</h3>
        <ul style={{marginTop:12,lineHeight:1.8,color:"var(--text-muted)",fontSize:14}}>
          <li>The mobile app fetches its active LLM key from <code>/api/public/active-llm</code> on every request.</li>
          <li>When you add or activate a key in the <strong>LLM & APIs</strong> page, the next translation/chat uses it immediately.</li>
          <li>When you <strong>ban a user</strong> on the Users page, that user can no longer log in to the mobile app (server returns 403).</li>
          <li>New scenarios and languages added in admin show up in the mobile app via <code>/api/public/scenarios</code> and <code>/api/public/languages</code>.</li>
          <li>This iframe is the actual <strong>Expo Web</strong> build of your <code>chinguspeak-app</code> repo — exactly what your users will see on the web. Native mobile builds (Android APK / iOS) use the same backend.</li>
        </ul>
      </div>
    </div>
  );
}
