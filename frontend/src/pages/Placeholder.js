import React from "react";
import { Construction } from "lucide-react";

export default function Placeholder({ title, description }) {
  return (
    <div data-testid={`placeholder-${title.toLowerCase().replace(/\s+/g,'-')}`}>
      <h2>{title}</h2>
      <div className="muted" style={{marginTop:6,fontSize:14}}>{description}</div>
      <div className="card" style={{marginTop:24,textAlign:"center",padding:60}}>
        <div className="empty">
          <div className="icon"><Construction size={24}/></div>
          <h3>Coming soon</h3>
          <div style={{marginTop:8,maxWidth:420,margin:"8px auto"}}>This section is wired in the admin and ready to be expanded. Open an issue with what you need here and I'll build it next.</div>
        </div>
      </div>
    </div>
  );
}
