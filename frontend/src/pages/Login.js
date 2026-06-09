import React, { useState } from "react";
import { Sparkles, Lock, Mail, ArrowRight } from "lucide-react";
import { useAuth } from "../lib/auth";
import { formatErr } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@chinguspeak.com");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await login(email.trim(), password);
      window.location.href = "/";
    } catch (e2) {
      setErr(formatErr(e2));
    } finally { setBusy(false); }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit} data-testid="login-form">
        <div className="brand">
          <div className="mark">CS</div>
          <div>
            <div style={{fontFamily:"'Sora'",fontWeight:800,fontSize:22,lineHeight:1}}>chingu<span style={{color:"#EC4899"}}>speak</span></div>
            <div className="dim" style={{fontSize:12,marginTop:4,letterSpacing:"0.08em"}}>ADMIN CONSOLE</div>
          </div>
        </div>

        <div className="callout" style={{marginBottom:22}}>
          <Sparkles size={16}/>
          <div>Welcome back, Super Admin. Sign in to manage every part of your app.</div>
        </div>

        <label className="muted" style={{fontSize:12,fontWeight:600,letterSpacing:"0.06em"}}>EMAIL</label>
        <div style={{position:"relative",marginTop:8,marginBottom:14}}>
          <Mail size={16} style={{position:"absolute",left:14,top:14,color:"#9CA3AF"}}/>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@chinguspeak.com"
            type="email"
            style={{paddingLeft:42}}
            data-testid="login-email"
            required
          />
        </div>

        <label className="muted" style={{fontSize:12,fontWeight:600,letterSpacing:"0.06em"}}>PASSWORD</label>
        <div style={{position:"relative",marginTop:8,marginBottom:8}}>
          <Lock size={16} style={{position:"absolute",left:14,top:14,color:"#9CA3AF"}}/>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            type="password"
            style={{paddingLeft:42}}
            data-testid="login-password"
            required
          />
        </div>

        {err && <div className="error-banner" data-testid="login-error">{err}</div>}

        <button className="btn primary" type="submit" disabled={busy} style={{width:"100%",justifyContent:"center",marginTop:18}} data-testid="login-submit">
          {busy ? <span className="spinner"/> : <>Sign in <ArrowRight size={16}/></>}
        </button>

        <div className="dim" style={{textAlign:"center",marginTop:16,fontSize:12}}>
          ChinguSpeak © {new Date().getFullYear()} · Super Admin only
        </div>
      </form>
    </div>
  );
}
