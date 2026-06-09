import React, { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Users, MessageSquare, UserCheck, DollarSign, TrendingUp, Coffee, Briefcase,
  Hotel, Plane, MessageCircle, Smartphone, Tablet, Monitor, Mic, Check,
} from "lucide-react";
import { apiClient } from "../lib/api";

const PIE_COLORS = ["#A855F7", "#EC4899", "#3B82F6", "#22D3EE", "#FBBF24", "#7F70A8"];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [topUsers, setTopUsers] = useState([]);

  useEffect(() => {
    apiClient.get("/dashboard/overview").then((r) => setData(r.data));
    apiClient.get("/dashboard/top-users").then((r) => setTopUsers(r.data.items || []));
  }, []);

  if (!data) return <div className="empty" data-testid="dashboard-loading">Loading dashboard…</div>;

  const stats = data.stats;
  const growth = data.growth_series.map((v, i) => ({ d: `D${i + 1}`, v }));
  const conv = data.conversations_series.map((v, i) => ({ d: `D${i + 1}`, v }));

  const cards = [
    { label: "Total Users", value: stats.total_users.toLocaleString(), icon: Users, delta: data.deltas.users, color: "#A855F7" },
    { label: "Conversations", value: stats.conversations.toLocaleString(), icon: MessageSquare, delta: data.deltas.conversations, color: "#EC4899" },
    { label: "Active Users", value: stats.active_users.toLocaleString(), icon: UserCheck, delta: data.deltas.active_users, color: "#22D3EE" },
    { label: "Revenue", value: "$" + stats.revenue_usd.toLocaleString(), icon: DollarSign, delta: data.deltas.revenue, color: "#FBBF24" },
  ];

  return (
    <div data-testid="dashboard-page">
      <div className="row between" style={{marginBottom:18}}>
        <h2>Dashboard Overview</h2>
        <button className="btn" data-testid="date-range">📅 May 14 – May 20, 2025</button>
      </div>

      <div className="stat-grid">
        {cards.map((c, i) => (
          <div key={i} className="stat-card" data-testid={`stat-${c.label.toLowerCase().replace(/\s+/g,"-")}`}>
            <div className="icon" style={{background:`${c.color}26`, color:c.color}}><c.icon size={22}/></div>
            <div className="label">{c.label}</div>
            <div className="value">{c.value}</div>
            <div className="delta"><TrendingUp size={14}/> {c.delta}% <span style={{color:"#7F70A8",fontWeight:400}}>vs last week</span></div>
            <div className="blob"/>
          </div>
        ))}
      </div>

      <div className="two-col" style={{marginTop:20}}>
        <div className="card">
          <div className="section-head"><h3>User Growth</h3><span className="tag blue">This Week</span></div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={growth}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A855F7" stopOpacity={0.6}/>
                  <stop offset="100%" stopColor="#A855F7" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false}/>
              <XAxis dataKey="d" stroke="#7F70A8" tick={{fontSize:11}}/>
              <YAxis stroke="#7F70A8" tick={{fontSize:11}}/>
              <Tooltip contentStyle={{background:"#1A0C2E",border:"1px solid #2A1A4A",borderRadius:12}} labelStyle={{color:"#fff"}}/>
              <Area type="monotone" dataKey="v" stroke="#A855F7" strokeWidth={2.5} fill="url(#g1)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="section-head"><h3>Conversations</h3><span className="tag blue">This Week</span></div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={conv}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false}/>
              <XAxis dataKey="d" stroke="#7F70A8" tick={{fontSize:11}}/>
              <YAxis stroke="#7F70A8" tick={{fontSize:11}}/>
              <Tooltip contentStyle={{background:"#1A0C2E",border:"1px solid #2A1A4A",borderRadius:12}} labelStyle={{color:"#fff"}}/>
              <Bar dataKey="v" fill="#EC4899" radius={[10,10,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="three-col" style={{marginTop:20}}>
        <div className="card">
          <div className="section-head"><h3>Top Languages</h3><span className="tag">This Week</span></div>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <ResponsiveContainer width={170} height={170}>
              <PieChart>
                <Pie data={data.top_languages} dataKey="percent" innerRadius={48} outerRadius={70} paddingAngle={3}>
                  {data.top_languages.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{flex:1}}>
              {data.top_languages.map((l, i) => (
                <div key={i} className="row between" style={{padding:"6px 0",fontSize:13}}>
                  <div className="row" style={{gap:8}}>
                    <span style={{width:10,height:10,borderRadius:"50%",background:PIE_COLORS[i % PIE_COLORS.length]}}/>
                    <span>{l.name}</span>
                  </div>
                  <span className="muted">{l.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-head"><h3>Popular Scenarios</h3></div>
          {data.popular_scenarios.map((s, i) => (
            <div key={i} className="row between" style={{padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
              <div className="row" style={{gap:10}}>
                <div style={{width:34,height:34,borderRadius:10,background:"rgba(168,85,247,0.18)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {{coffee:<Coffee size={16}/>, briefcase:<Briefcase size={16}/>, hotel:<Hotel size={16}/>, plane:<Plane size={16}/>, message:<MessageCircle size={16}/>}[s.icon] || <MessageCircle size={16}/>}
                </div>
                <span style={{fontSize:13,fontWeight:500}}>{s.title}</span>
              </div>
              <span className="muted" style={{fontSize:13}}>{s.count.toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="section-head"><h3>Recent Activity</h3></div>
          {data.recent_activity.map((a, i) => (
            <div key={i} className="row" style={{padding:"10px 0",borderBottom:"1px solid var(--border)",gap:12}}>
              <div style={{width:34,height:34,borderRadius:10,background:"rgba(236,72,153,0.18)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {a.type === "user" ? <Users size={16}/> : <MessageSquare size={16}/>}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500}}>{a.label}</div>
                <div className="dim" style={{fontSize:11}}>{a.name}</div>
              </div>
              <div className="dim" style={{fontSize:11}}>just now</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{marginTop:20}}>
        <div className="section-head">
          <h3>Top Users (This Week)</h3>
          <button className="btn sm" data-testid="view-all-users">View All Users</button>
        </div>
        <table className="table" data-testid="top-users-table">
          <thead>
            <tr><th>#</th><th>User</th><th>Conversations</th><th>Time</th><th>Progress</th><th>Country</th></tr>
          </thead>
          <tbody>
            {(topUsers.length ? topUsers : []).slice(0, 5).map((u, i) => (
              <tr key={u.id}>
                <td>{i + 1}</td>
                <td>
                  <div className="row" style={{gap:10}}>
                    <div className="avatar" style={{width:32,height:32,fontSize:13}}>{(u.name||"U").slice(0,1)}</div>
                    <div>
                      <div style={{fontWeight:600}}>{u.name}</div>
                      <div className="dim" style={{fontSize:11}}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>{u.conversations_count?.toLocaleString()}</td>
                <td>{Math.floor((u.time_spent_minutes||0)/60)}h {(u.time_spent_minutes||0)%60}m</td>
                <td><span style={{color:"#34D399",fontWeight:700}}>{u.progress}%</span></td>
                <td>{u.country_flag} </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AppStyleAndPreview />
    </div>
  );
}

function AppStyleAndPreview() {
  const [styles, setStyles] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    apiClient.get("/styles").then((r) => {
      setStyles(r.data.items || []);
      const a = (r.data.items || []).find((s) => s.is_active);
      setSelected(a?.id || (r.data.items?.[0]?.id));
    });
  }, []);

  const apply = async () => {
    if (!selected) return;
    await apiClient.post(`/styles/${selected}/apply`);
    const { data } = await apiClient.get("/styles");
    setStyles(data.items || []);
  };

  return (
    <div className="two-col" style={{marginTop:20}}>
      <div className="card">
        <div className="section-head"><h3>Select App Style</h3><span className="muted" style={{fontSize:13}}>Choose the style for your app experience</span></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
          {styles.map((s) => (
            <div key={s.id}
                 onClick={() => setSelected(s.id)}
                 data-testid={`style-card-${s.id}`}
                 style={{
                   padding:14,borderRadius:18,
                   border:`2px solid ${selected===s.id?"#A855F7":"rgba(255,255,255,0.1)"}`,
                   background:"rgba(255,255,255,0.04)",cursor:"pointer",position:"relative"
                 }}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <strong>{s.name}</strong>
                {selected === s.id && <Check size={18} color="#A855F7"/>}
              </div>
              <div className="phone-frame" style={{margin:"0 auto",width:160,padding:8}}>
                <div className="phone-screen" style={{
                  height:220,padding:14,
                  background:`linear-gradient(160deg, ${s.primary_color}40, ${s.secondary_color}40, ${s.background})`,
                }}>
                  <div style={{fontFamily:"'Sora'",fontWeight:800,fontSize:14}}>chingu<span style={{color:s.primary_color}}>speak</span></div>
                  <div style={{
                    width:60,height:60,borderRadius:"50%",
                    background:`linear-gradient(135deg, ${s.primary_color}, ${s.secondary_color})`,
                    boxShadow:`0 0 40px ${s.primary_color}80`,
                  }}/>
                  <div style={{fontSize:10,opacity:0.8}}>Hi! I'm Chingu 👋</div>
                  <div style={{
                    width:48,height:48,borderRadius:"50%",
                    background:`linear-gradient(135deg, ${s.primary_color}, ${s.secondary_color})`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    boxShadow:`0 6px 24px ${s.primary_color}80`,
                  }}><Mic size={20} color="#fff"/></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="row" style={{marginTop:16,gap:10}}>
          <button className="btn" style={{flex:1,justifyContent:"center"}} data-testid="preview-mobile-btn">📱 Preview in Mobile</button>
          <button className="btn primary" style={{flex:1,justifyContent:"center"}} onClick={apply} data-testid="apply-style-btn">Apply Style</button>
        </div>
      </div>

      <div className="card">
        <div className="section-head">
          <h3>App Preview</h3>
          <div className="row" style={{gap:6}}>
            <button className="btn sm ghost" data-testid="preview-device-desktop"><Monitor size={14}/></button>
            <button className="btn sm ghost" data-testid="preview-device-tablet"><Tablet size={14}/></button>
            <button className="btn sm ghost" data-testid="preview-device-mobile"><Smartphone size={14}/></button>
          </div>
        </div>
        {(() => {
          const s = styles.find((x) => x.id === selected) || styles[0];
          if (!s) return <div className="empty">No styles yet</div>;
          return (
            <div style={{display:"flex",justifyContent:"center",padding:"14px 0"}}>
              <div className="phone-frame" style={{width:240}}>
                <div className="phone-screen" style={{
                  background:`linear-gradient(180deg, ${s.background}, ${s.primary_color}33)`,
                  height:460,
                }}>
                  <div style={{fontFamily:"'Sora'",fontWeight:800,fontSize:18}}>chingu<span style={{color:s.primary_color}}>speak</span></div>
                  <div style={{
                    width:130,height:130,borderRadius:"50%",
                    background:`radial-gradient(circle, ${s.primary_color}, ${s.secondary_color} 60%, transparent 80%)`,
                    boxShadow:`0 0 80px ${s.primary_color}80`,
                  }}/>
                  <div style={{fontSize:14,fontWeight:600}}>Hi! I'm Chingu 👋</div>
                  <div style={{fontSize:11,opacity:0.7}}>Your AI translation friend</div>
                  <div style={{
                    background:`linear-gradient(90deg, ${s.primary_color}, ${s.secondary_color})`,
                    padding:"10px 22px",borderRadius:999,fontSize:12,fontWeight:700,
                    boxShadow:`0 10px 24px ${s.primary_color}66`
                  }}>Start Live Speak</div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
