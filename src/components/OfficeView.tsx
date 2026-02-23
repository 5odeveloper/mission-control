'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────
interface AgentStatus {
  id: string; name: string; emoji: string; color: string;
  status: 'active' | 'idle' | 'error';
  sessionName: string; channel: string; lastActive: string;
  totalTokens: number; sessions: number;
  currentTask: string;    // e.g. "Subagent: mc-task-office-polish" or "Listening"
  currentTaskAge: number; // ms since task started
  isRunning: boolean;     // true if newest session updated < 2 min ago
}

// ── Config ─────────────────────────────────────────────────────────────────
const AGENTS_CONFIG = [
  { id: 'main',         name: '5oMASTER',    emoji: '🧠', color: '#7c3aed', role: 'Commander / PM'   },
  { id: '5otrader',    name: '5oTRADER',    emoji: '📈', color: '#059669', role: 'Trading Assistant' },
  { id: '5odeveloper', name: '5oDEVELOPER', emoji: '💻', color: '#2563eb', role: 'Senior Developer'  },
];

const CRONS: Record<string, { name: string; status: 'ok' | 'err' }[]> = {
  '5otrader': [
    { name: 'XAUUSD Scalper',   status: 'ok'  },
    { name: 'MT5 Report',       status: 'ok'  },
    { name: 'Gold News',        status: 'ok'  },
    { name: 'Learning Report',  status: 'ok'  },
    { name: 'Weekend Research', status: 'err' },
  ],
  '5odeveloper': [
    { name: 'discord-post-1',    status: 'ok' },
    { name: 'discord-post-2',    status: 'ok' },
    { name: 'discord-post-3',    status: 'ok' },
    { name: 'discord-post-4',    status: 'ok' },
    { name: 'daily-ai-research', status: 'ok' },
    { name: 'discord-content',   status: 'ok' },
  ],
};

// ── Helpers ────────────────────────────────────────────────────────────────
function timeAgo(ms: number): string {
  const d = Date.now() - ms;
  if (d < 60000) return 'just now';
  if (d < 3600000) return Math.floor(d / 60000) + 'm ago';
  return Math.floor(d / 3600000) + 'h ago';
}
function fmtSession(s: { kind?: string; displayName?: string; key?: string; label?: string }): string {
  if (s.kind === 'group') return 'grp:' + (s.displayName || s.key || '').replace('telegram:g-', '').substring(0, 10);
  if (s.kind === 'other' && s.label) return 'cron:' + s.label.substring(0, 12);
  return s.kind || 'session';
}
function fmtBytes(n: number, total: number): string {
  const gb = 1024 * 1024 * 1024;
  return `${(n/gb).toFixed(1)}/${(total/gb).toFixed(1)} GB`;
}

// ── Pixel Avatars ──────────────────────────────────────────────────────────
const px: React.CSSProperties = { imageRendering: 'pixelated', display: 'block' };
function AvatarMaster()    { return <svg width="32" height="32" viewBox="0 0 8 8" style={px}><rect x="2" y="0" width="4" height="4" fill="#c084fc"/><rect x="2" y="1" width="1" height="1" fill="#000"/><rect x="5" y="1" width="1" height="1" fill="#000"/><rect x="3" y="3" width="2" height="1" fill="#000"/><rect x="1" y="4" width="6" height="3" fill="#7c3aed"/><rect x="0" y="4" width="1" height="2" fill="#7c3aed"/><rect x="7" y="4" width="1" height="2" fill="#7c3aed"/><rect x="2" y="7" width="1" height="1" fill="#4a1d96"/><rect x="5" y="7" width="1" height="1" fill="#4a1d96"/><rect x="3" y="0" width="1" height="1" fill="#f59e0b"/><rect x="5" y="0" width="1" height="1" fill="#f59e0b"/></svg>; }
function AvatarTrader()    { return <svg width="32" height="32" viewBox="0 0 8 8" style={px}><rect x="2" y="0" width="4" height="4" fill="#6ee7b7"/><rect x="2" y="1" width="1" height="1" fill="#000"/><rect x="5" y="1" width="1" height="1" fill="#000"/><rect x="3" y="3" width="2" height="1" fill="#000"/><rect x="1" y="4" width="6" height="3" fill="#059669"/><rect x="0" y="4" width="1" height="2" fill="#059669"/><rect x="7" y="4" width="1" height="2" fill="#059669"/><rect x="2" y="7" width="1" height="1" fill="#065f46"/><rect x="5" y="7" width="1" height="1" fill="#065f46"/><rect x="2" y="0" width="4" height="1" fill="#f59e0b"/></svg>; }
function AvatarDeveloper() { return <svg width="32" height="32" viewBox="0 0 8 8" style={px}><rect x="2" y="0" width="4" height="4" fill="#93c5fd"/><rect x="2" y="1" width="1" height="1" fill="#000"/><rect x="5" y="1" width="1" height="1" fill="#000"/><rect x="3" y="3" width="2" height="1" fill="#000"/><rect x="1" y="4" width="6" height="3" fill="#2563eb"/><rect x="0" y="4" width="1" height="2" fill="#2563eb"/><rect x="7" y="4" width="1" height="2" fill="#2563eb"/><rect x="2" y="7" width="1" height="1" fill="#1e3a8a"/><rect x="5" y="7" width="1" height="1" fill="#1e3a8a"/></svg>; }
const AVATARS: Record<string, () => JSX.Element> = { main: AvatarMaster, '5otrader': AvatarTrader, '5odeveloper': AvatarDeveloper };

// ── Status Badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: 'active' | 'idle' | 'error' }) {
  const styles: Record<string, React.CSSProperties> = {
    active: { background: 'rgba(22,101,52,0.4)',  color: '#4ade80', border: '1px solid #166534' },
    idle:   { background: 'rgba(120,53,15,0.4)',  color: '#fbbf24', border: '1px solid #78350f' },
    error:  { background: 'rgba(127,29,29,0.4)',  color: '#f87171', border: '1px solid #7f1d1d' },
  };
  return (
    <span style={{
      ...styles[status],
      fontSize: 10, fontWeight: 700, padding: '2px 8px',
      borderRadius: 10, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'inherit',
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }}/>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Workstation ────────────────────────────────────────────────────────────
function Workstation({ agent, selected, onClick }: {
  agent: AgentStatus; selected: boolean; onClick: () => void;
}) {
  const Avatar = AVATARS[agent.id];
  const on  = agent.status === 'active';
  const err = agent.status === 'error';
  return (
    <div className="office-ws" onClick={onClick}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, cursor:'pointer', userSelect:'none' }}>
      {/* Desk */}
      <div style={{
        width:100, height:64,
        border:`2px solid ${selected ? agent.color : agent.color+'88'}`, borderRadius:6,
        background: selected ? agent.color+'22' : agent.color+'11', position:'relative',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow: selected ? `0 0 0 3px #fff2,0 0 24px ${agent.color}88`
                 : on       ? `0 0 12px ${agent.color}44` : 'none',
        transition:'all 0.25s ease',
      }}>
        {/* Monitor */}
        <div style={{ width:36, height:26, border:`2px solid ${agent.color}99`, borderRadius:2, background:'#000',
          display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
          <div style={{
            width:28, height:18, borderRadius:1, fontSize:10,
            background: on?'#001a0a': err?'#1a0000':'#0a0a0a',
            boxShadow:  on?'0 0 5px #00ff88': err?'0 0 5px #ff3333':'none',
            display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.3s',
          }}>{on?'💻':err?'⚠️':'🔲'}</div>
          <div style={{ position:'absolute', bottom:-5, width:10, height:3, background:agent.color, opacity:0.5, borderRadius:1 }}/>
        </div>
        {/* Avatar */}
        <div className={on?'av-active':err?'av-error':'av-idle'} style={{ position:'absolute' }}>
          <Avatar/>
        </div>
        {/* Status dot */}
        <div style={{
          position:'absolute', top:-5, right:-5, width:12, height:12, borderRadius:'50%',
          background: on?'#22c55e':err?'#f85149':'#6b7280',
          border:'2px solid #0a0a0f',
          boxShadow: on?'0 0 6px #22c55e':err?'0 0 6px #f85149':'none',
        }}/>
      </div>
      {/* Nameplate */}
      <div style={{
        fontFamily:"'Press Start 2P',monospace", fontSize:7, padding:'3px 8px',
        border:`1px solid ${agent.color}88`, borderRadius:2,
        background:'#00000088', color:agent.color, whiteSpace:'nowrap',
        marginTop:36,
      }}>{agent.emoji} {agent.name}</div>
      {/* Status badge */}
      <StatusBadge status={agent.status}/>
    </div>
  );
}

// ── Bottom Sheet (mobile) ──────────────────────────────────────────────────
function BottomSheet({ agent, open, onClose }: {
  agent: AgentStatus | null; open: boolean; onClose: () => void;
}) {
  const sheetRef   = useRef<HTMLDivElement>(null);
  const startY     = useRef(0);
  const currentY   = useRef(0);
  const dragging   = useRef(false);

  const TRANSITION = 'transform 0.35s cubic-bezier(0.32,0.72,0,1)';

  // Swipe-down to dismiss — directly manipulate style to avoid stale ref issue
  const onTouchStart = (e: React.TouchEvent) => {
    startY.current   = e.touches[0].clientY;
    currentY.current = 0;
    dragging.current = true;
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || !sheetRef.current) return;
    const dy = e.touches[0].clientY - startY.current;
    currentY.current = dy;
    if (dy > 0) {
      sheetRef.current.style.transform = `translateY(${dy}px)`;
    }
  };
  const onTouchEnd = () => {
    dragging.current = false;
    if (!sheetRef.current) return;
    sheetRef.current.style.transition = TRANSITION;
    if (currentY.current > 80) {
      // animate off-screen then call onClose
      sheetRef.current.style.transform = 'translateY(100%)';
      setTimeout(onClose, 350);
    } else {
      sheetRef.current.style.transform = 'translateY(0)';
    }
    currentY.current = 0;
  };

  // Reset position when opening
  useEffect(() => {
    if (!sheetRef.current) return;
    sheetRef.current.style.transition = TRANSITION;
    sheetRef.current.style.transform  = open ? 'translateY(0)' : 'translateY(100%)';
  }, [open]);

  if (!agent) return null;
  const crons    = CRONS[agent.id];
  const tokenPct = Math.min((agent.totalTokens / 200000) * 100, 100);
  const cfg      = AGENTS_CONFIG.find(c => c.id === agent.id);

  return (
    <>
      {/* Backdrop — tap outside to close */}
      <div
        onClick={onClose}
        style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.65)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition:'opacity 0.3s', zIndex:99,
        }}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position:'fixed', bottom:0, left:0, right:0,
          background:'#161b22',
          borderTop:`3px solid ${agent.color}`,
          borderLeft:'1px solid #30363d',
          borderRight:'1px solid #30363d',
          borderRadius:'20px 20px 0 0',
          zIndex:100,
          maxHeight:'76vh',
          overflowY:'auto',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          willChange:'transform',
          boxShadow:'0 -8px 32px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag handle */}
        <div style={{ display:'flex', justifyContent:'center', padding:'14px 0 6px', touchAction:'none' }}>
          <div style={{ width:40, height:4, background:'#30363d', borderRadius:2 }}/>
        </div>

        <div style={{ padding:'4px 20px 36px' }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{
                width:48, height:48, borderRadius:12,
                background:agent.color+'1a', border:`1px solid ${agent.color}66`,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
              }}>{agent.emoji}</div>
              <div>
                <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:9, color:'#c9d1d9', marginBottom:6 }}>{agent.name}</div>
                <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:'#8b949e' }}>{cfg?.role}</div>
              </div>
            </div>
            <StatusBadge status={agent.status}/>
          </div>

          {/* Running progress bar */}
          {agent.isRunning && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ height: 3, background: '#21262d', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  background: `linear-gradient(90deg, ${agent.color}, ${agent.color}88)`,
                  animation: 'task-progress 2s ease-in-out infinite',
                  width: '60%',
                }}/>
              </div>
              <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize: 6, color: '#8b949e', marginTop: 4 }}>⚡ Task in progress · {agent.lastActive}</div>
            </div>
          )}

          {/* Info rows */}
          {[
            ['SESSION',       agent.sessionName],
            ['CHANNEL',       agent.channel],
            ['LAST SEEN',     agent.lastActive],
            ['MODEL',         'claude-sonnet-4-6'],
            ['SESSIONS',      String(agent.sessions)],
            ['CURRENT TASK',  agent.currentTask],
            ['STATUS',        agent.isRunning ? '⚡ Running' : '— Idle'],
          ].map(([k,v]) => (
            <div key={k} style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'10px 0', borderBottom:'1px solid #21262d',
              fontFamily:"'Press Start 2P',monospace",
            }}>
              <span style={{ fontSize:7, color:'#8b949e' }}>{k}</span>
              <span style={{ fontSize:7, color:'#c9d1d9', maxWidth:180, textAlign:'right', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</span>
            </div>
          ))}

          {/* Token bar */}
          <div style={{ marginTop:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontFamily:"'Press Start 2P',monospace", fontSize:7, color:'#8b949e', marginBottom:8 }}>
              <span>CTX USAGE</span>
              <span style={{ color:'#c9d1d9' }}>{agent.totalTokens.toLocaleString()} / 200k</span>
            </div>
            <div style={{ height:8, background:'#21262d', borderRadius:4, overflow:'hidden' }}>
              <div style={{
                height:'100%', width:`${tokenPct}%`, borderRadius:4, transition:'width 0.5s',
                background: tokenPct > 80 ? '#f85149' : tokenPct > 50 ? '#d29922' : agent.color,
                boxShadow: tokenPct > 80 ? `0 0 8px #f85149` : 'none',
              }}/>
            </div>
            <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:6, color:'#8b949e', marginTop:4, textAlign:'right' }}>
              {tokenPct.toFixed(0)}% of context
            </div>
          </div>

          {/* Cron jobs */}
          {crons && (
            <div style={{ marginTop:20 }}>
              <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:'#8b949e', marginBottom:10, letterSpacing:1 }}>
                CRON JOBS ({crons.length})
              </div>
              <div style={{ border:'1px solid #30363d', borderRadius:8, overflow:'hidden' }}>
                {crons.map((c, i) => (
                  <div key={c.name} style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'9px 14px',
                    background: i%2===0 ? '#161b22' : '#0d1117',
                    borderBottom: i < crons.length-1 ? '1px solid #21262d' : 'none',
                  }}>
                    <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:'#c9d1d9' }}>{c.name}</span>
                    <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:6, color: c.status==='ok'?'#4ade80':'#f87171', display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:'currentColor', display:'inline-block' }}/>
                      {c.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Desktop Agent Card ─────────────────────────────────────────────────────
function AgentCard({ agent, selected, onClick }: { agent: AgentStatus; selected: boolean; onClick: () => void }) {
  const crons    = CRONS[agent.id];
  const tokenPct = Math.min((agent.totalTokens / 200000) * 100, 100);
  const cfg      = AGENTS_CONFIG.find(c => c.id === agent.id);

  return (
    <div onClick={onClick} style={{
      background:'#161b22',
      border:'1px solid #30363d',
      borderLeft:`3px solid ${agent.color}`,
      borderRadius:10, padding:14,
      cursor:'pointer', transition:'all 0.2s ease',
      boxShadow: selected ? `0 0 0 1px ${agent.color}44, 0 4px 16px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.2)',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 1px #30363d'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)'; }}
    >
      {/* Header row: avatar + name + badge */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <div style={{
          width:40, height:40, borderRadius:10, flexShrink:0,
          background:agent.color+'1a', border:`1px solid ${agent.color}44`,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
        }}>{cfg?.emoji || agent.emoji}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:8, color:'#c9d1d9', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{agent.name}</div>
          <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:6, color:'#8b949e', marginTop:4 }}>{cfg?.role}</div>
        </div>
        <StatusBadge status={agent.status}/>
      </div>

      {/* Session info */}
      <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:6, color:'#8b949e', lineHeight:2.2, marginBottom:10 }}>
        <div>SESSION: <span style={{ color:'#c9d1d9' }}>{agent.sessionName}</span></div>
        <div>CHANNEL: <span style={{ color:'#c9d1d9' }}>{agent.channel}</span></div>
        <div>LAST: <span style={{ color:agent.status==='active'?'#4ade80':'#c9d1d9' }}>{agent.lastActive}</span></div>
      </div>

      {/* Token bar */}
      <div style={{ marginBottom:10 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontFamily:"'Press Start 2P',monospace", fontSize:6, color:'#8b949e', marginBottom:4 }}>
          <span>CTX</span>
          <span style={{ color: tokenPct > 80 ? '#f87171' : '#c9d1d9' }}>{agent.totalTokens.toLocaleString()} / 200k</span>
        </div>
        <div style={{ height:4, background:'#21262d', borderRadius:2, overflow:'hidden' }}>
          <div style={{
            height:'100%', width:`${tokenPct}%`, borderRadius:2, transition:'width 0.5s',
            background: tokenPct > 80 ? '#f85149' : tokenPct > 50 ? '#d29922' : agent.color,
          }}/>
        </div>
      </div>

      {/* Current Task */}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #21262d' }}>
        <div style={{ fontSize: 6, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5, fontFamily:"'Press Start 2P',monospace" }}>
          Current Task
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: agent.isRunning ? '#4ade80' : '#6b7280',
            boxShadow: agent.isRunning ? '0 0 6px #4ade80' : 'none',
            animation: agent.isRunning ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
          }}/>
          <span style={{ fontSize: 6, color: '#c9d1d9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily:"'Press Start 2P',monospace" }}>
            {agent.currentTask}
          </span>
        </div>
        {agent.isRunning && (
          <div style={{ fontSize: 6, color: '#8b949e', marginTop: 3, fontFamily:"'Press Start 2P',monospace" }}>
            Running · {agent.lastActive}
          </div>
        )}
      </div>

      {/* Cron jobs */}
      {crons && (
        <div style={{ paddingTop:10, borderTop:'1px solid #21262d', fontFamily:"'Press Start 2P',monospace", fontSize:6, color:'#8b949e' }}>
          <div style={{ marginBottom:6 }}>CRONS ({crons.length})</div>
          {crons.map(c => (
            <div key={c.name} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', alignItems:'center' }}>
              <span style={{ color:'#c9d1d9' }}>{c.name}</span>
              <span style={{ color:c.status==='ok'?'#4ade80':'#f87171', display:'flex', alignItems:'center', gap:3 }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:'currentColor', display:'inline-block' }}/>
                {c.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export function OfficeView() {
  const [agents, setAgents]       = useState<AgentStatus[]>([]);
  const [selected, setSelected]   = useState('main');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetAgent, setSheetAgent] = useState<AgentStatus | null>(null);
  const [clock, setClock]         = useState('');
  const [countdown, setCountdown] = useState(5);
  const [conn, setConn]           = useState<'live'|'mock'|'offline'>('offline');

  const mock = useCallback((): AgentStatus[] => [
    { id:'main',         name:'5oMASTER',    emoji:'🧠', color:'#7c3aed', status:'active', sessionName:'grp:5oMaster',  channel:'TELEGRAM', lastActive:'just now', totalTokens:25651,  sessions:1, currentTask:'Chat: 5oMaster Group',  currentTaskAge:30000,   isRunning:true  },
    { id:'5otrader',    name:'5oTRADER',    emoji:'📈', color:'#059669', status:'active', sessionName:'cron:XAUUSD',   channel:'CRON',     lastActive:'2m ago',   totalTokens:188028, sessions:2, currentTask:'XAUUSD Scalper',         currentTaskAge:110000,  isRunning:true  },
    { id:'5odeveloper', name:'5oDEVELOPER', emoji:'💻', color:'#2563eb', status:'idle',   sessionName:'grp:dev',       channel:'TELEGRAM', lastActive:'5m ago',   totalTokens:144609, sessions:1, currentTask:'Listening',              currentTaskAge:300000,  isRunning:false },
  ], []);

  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch('/api/openclaw/sessions');
      if (!r.ok) throw new Error();
      const d = await r.json();
      // API returns { sessions: { sessions: [...] } } — extract the inner array
      const raw = d.sessions;
      const sessions: Array<{ key?:string; updatedAt?:number; totalTokens?:number; kind?:string; displayName?:string; label?:string; channel?:string }> =
        Array.isArray(raw) ? raw : (Array.isArray(raw?.sessions) ? raw.sessions : []);
      const now = Date.now();
      setAgents(AGENTS_CONFIG.map(cfg => {
        const ag = sessions.filter(s => s.key?.split(':')[1] === cfg.id);
        // Active = updated within last 10 minutes
        const act = ag.filter(s => (now - (s.updatedAt||0)) < 600000);
        const last = [...ag].sort((a,b) => (b.updatedAt||0)-(a.updatedAt||0))[0];
        // Derive current task label from the newest session
        const getTaskLabel = (s: typeof last): string => {
          if (!s) return 'Listening';
          if (s.label) return s.label;
          if (s.kind === 'group') return `Chat: ${(s.displayName||'').replace('telegram:g-','grp:') || s.key?.split(':').slice(2).join(':') || 'group'}`;
          if (s.kind === 'other') return s.label || s.displayName || 'Task';
          return 'Session';
        };
        const isRunning = last ? (now - (last.updatedAt||0)) < 120000 : false;
        return {
          ...cfg,
          status: (act.length > 0 ? 'active' : 'idle') as 'active'|'idle'|'error',
          totalTokens: ag.reduce((s,x) => s+(x.totalTokens||0), 0),
          lastActive: last ? timeAgo(last.updatedAt||0) : 'unknown',
          sessionName: last ? fmtSession(last) : 'none',
          channel: (last?.channel||'UNKNOWN').toUpperCase(),
          sessions: ag.length,
          currentTask: getTaskLabel(last),
          currentTaskAge: last ? now - (last.updatedAt||0) : 0,
          isRunning,
        };
      }));
      setConn('live');
    } catch {
      if (agents.length === 0) setAgents(mock());
      setConn('mock');
    }
  }, [agents.length, mock]);

  // Clock (Kuwait +3)
  useEffect(() => {
    const t = setInterval(() => {
      const kw = new Date(Date.now() + 3*3600000);
      setClock(`${String(kw.getUTCHours()).padStart(2,'0')}:${String(kw.getUTCMinutes()).padStart(2,'0')}:${String(kw.getUTCSeconds()).padStart(2,'0')} KWT`);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Refresh timer
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => { if (c<=1){ fetch_(); return 5; } return c-1; }), 1000);
    return () => clearInterval(t);
  }, [fetch_]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const openSheet = (agent: AgentStatus) => {
    setSheetAgent(agent);
    setSheetOpen(true);
  };

  const closeSheet = () => setSheetOpen(false);

  const selectedAgent = agents.find(a => a.id === selected);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

        /* ── Animations ── */
        @keyframes ws-typing { 0%,100%{transform:translateY(0) translateX(-50%)} 50%{transform:translateY(-3px) translateX(-50%)} }
        @keyframes ws-float  { 0%,100%{transform:translateY(0) translateX(-16px)} 50%{transform:translateY(-2px) translateX(-16px)} }
        @keyframes ws-shake  { 0%,100%{transform:translateX(-50%)} 25%{transform:translateX(calc(-50% - 2px))} 75%{transform:translateX(calc(-50% + 2px))} }
        @keyframes badge-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes task-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }

        .av-active { bottom:42px; left:50%; animation:ws-typing 0.4s ease-in-out infinite; }
        .av-idle   { bottom:8px;  left:0;   animation:ws-float  2s    ease-in-out infinite; }
        .av-error  { bottom:42px; left:50%; animation:ws-shake  0.3s  ease-in-out infinite; }

        .office-ws { transition:transform 0.2s ease, filter 0.2s ease; }
        .office-ws:hover  { transform:scale(1.07); filter:brightness(1.1); }
        .office-ws:active { transform:scale(0.95); }

        .office-floor {
          background: repeating-conic-gradient(#111118 0% 25%, #0d0d14 0% 50%) 0 0 / 40px 40px;
        }
        .office-crt { position:relative; }
        .office-crt::after {
          content:''; position:absolute; inset:0; pointer-events:none; z-index:1;
          background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.03) 2px,rgba(0,0,0,.03) 4px);
        }

        /* ─── DESKTOP (≥ 768px) ─────────────────────────────────── */
        .ov-layout      { display:flex; flex-direction:row; height:100%; background:#0a0a0f; color:#e0e0ff; font-family:'Press Start 2P',monospace; overflow:hidden; }
        .ov-main        { flex:1; position:relative; overflow:hidden; }
        .ov-topbar      { position:absolute; top:0; left:0; right:0; height:44px; background:#0d1117; border-bottom:1px solid #30363d; display:flex; align-items:center; justify-content:space-between; padding:0 16px; z-index:10; }
        .ov-topbar-title{ font-size:10px; color:#7c3aed; text-shadow:0 0 10px #7c3aed99; letter-spacing:2px; }
        .ov-topbar-right{ display:flex; gap:14px; align-items:center; font-size:7px; }
        .ov-ws-area     { position:absolute; inset:0; top:44px; }
        .ws-master      { position:absolute; top:80px; left:50%; transform:translateX(-50%); }
        .ws-trader      { position:absolute; top:240px; left:12%; }
        .ws-dev         { position:absolute; top:240px; right:12%; }
        .ov-sidebar     { width:300px; background:#0d1117; border-left:1px solid #30363d; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:10px; flex-shrink:0; }
        .ov-sidebar-hdr { font-size:7px; color:#8b949e; letter-spacing:2px; padding-bottom:10px; border-bottom:1px solid #30363d; }
        .ov-mobile-hint { display:none; }
        .ov-detail      { background:#161b22; border:1px solid #30363d; border-radius:8px; padding:12px; }
        .ov-detail-row  { display:flex; justify-content:space-between; font-family:'Press Start 2P',monospace; font-size:7px; color:#8b949e; padding:5px 0; border-bottom:1px solid #21262d; }
        .ov-footer      { position:absolute; bottom:8px; left:50%; transform:translateX(-50%); font-family:'Press Start 2P',monospace; font-size:6px; color:#21262d; letter-spacing:1px; white-space:nowrap; z-index:2; }
        .ov-lines       { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
        .ov-mobile-bar  { display:none; }

        /* ─── MOBILE (< 768px) ──────────────────────────────────── */
        @media (max-width:767px) {
          .ov-layout     { flex-direction:column; height:100%; overflow:hidden; }
          .ov-main       { flex:1; position:relative; overflow:hidden; }
          .ov-topbar-title { font-size:8px; }
          .ov-topbar-right { font-size:6px; gap:10px; }
          .ov-sidebar    { display:none; }
          .ws-master     { position:absolute; top:70px; left:50%; transform:translateX(-50%); }
          .ws-trader     { position:absolute; top:210px; left:8%; transform:none; }
          .ws-dev        { position:absolute; top:210px; right:8%; transform:none; }
          .ov-mobile-hint {
            display:flex; position:absolute; bottom:10px; left:50%; transform:translateX(-50%);
            gap:6px; align-items:center;
            font-family:'Press Start 2P',monospace; font-size:6px; color:#30363d; white-space:nowrap;
          }
          .ov-footer     { display:none; }
        }

        /* Sidebar scrollbar */
        .ov-sidebar::-webkit-scrollbar { width:3px; }
        .ov-sidebar::-webkit-scrollbar-thumb { background:#30363d; border-radius:2px; }
      `}</style>

      <div className="ov-layout">

        {/* ── Office Floor ── */}
        <div className="ov-main office-floor office-crt">

          <div className="ov-topbar">
            <span className="ov-topbar-title">👾 THE OPERATION</span>
            <div className="ov-topbar-right">
              <span style={{ color:'#8b949e' }}>SYNC <span style={{ color: countdown<=2?'#4ade80':'#8b949e' }}>{countdown}s</span></span>
              <span style={{ color:'#4ade80', fontVariantNumeric:'tabular-nums' }}>{clock}</span>
              <span style={{ color: conn==='live'?'#4ade80': conn==='mock'?'#d29922':'#6b7280' }}>● {conn.toUpperCase()}</span>
            </div>
          </div>

          {/* Wall */}
          <div style={{ position:'absolute', top:44, left:0, right:0, height:40, background:'#161b22', borderBottom:'1px solid #30363d',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:2 }}>
            <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:'#30363d', letterSpacing:3 }}>🏢 HQ</span>
          </div>

          {/* Workstations */}
          <div className="ov-ws-area" style={{ zIndex:3 }}>
            {agents.length > 0 && (<>
              <div className="ws-master"
                style={{ transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.03)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}>
                <Workstation agent={agents[0]} selected={selected===agents[0].id}
                  onClick={() => { setSelected(agents[0].id); openSheet(agents[0]); }}/>
              </div>
              <div className="ws-trader"
                style={{ transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.03)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}>
                <Workstation agent={agents[1]} selected={selected===agents[1].id}
                  onClick={() => { setSelected(agents[1].id); openSheet(agents[1]); }}/>
              </div>
              <div className="ws-dev"
                style={{ transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.03)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}>
                <Workstation agent={agents[2]} selected={selected===agents[2].id}
                  onClick={() => { setSelected(agents[2].id); openSheet(agents[2]); }}/>
              </div>
            </>)}

            {/* Connection lines */}
            <svg className="ov-lines">
              <line x1="50%" y1="175" x2="18%" y2="300" stroke="#7c3aed" strokeWidth="1" strokeDasharray="4,4" opacity="0.15"/>
              <line x1="50%" y1="175" x2="82%" y2="300" stroke="#7c3aed" strokeWidth="1" strokeDasharray="4,4" opacity="0.15"/>
              <line x1="18%" y1="300" x2="82%" y2="300" stroke="#30363d" strokeWidth="1" strokeDasharray="4,4" opacity="0.2"/>
            </svg>
          </div>

          {/* Mobile tap hint */}
          <div className="ov-mobile-hint">
            <span style={{ animation:'badge-pulse 2s infinite' }}>▲</span>
            <span>TAP AN AGENT FOR DETAILS</span>
            <span style={{ animation:'badge-pulse 2s infinite' }}>▲</span>
          </div>

          <div className="ov-footer">OPENCLAW v2026 // AMS</div>
        </div>

        {/* ── Desktop Sidebar ── */}
        <div className="ov-sidebar">
          <div className="ov-sidebar-hdr">{'// AGENT STATUS'}</div>

          {agents.map(a => (
            <AgentCard key={a.id} agent={a} selected={selected===a.id}
              onClick={() => setSelected(a.id)}/>
          ))}

          {selectedAgent && (
            <div className="ov-detail">
              <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:'#8b949e', marginBottom:10 }}>
                {'// SELECTED'}
              </div>
              {([
                ['AGENT ID', selectedAgent.id],
                ['ROLE',     AGENTS_CONFIG.find(c=>c.id===selectedAgent.id)?.role||'—'],
                ['MODEL',    'claude-sonnet-4-6'],
                ['SESSIONS', String(selectedAgent.sessions)],
                ['TOKENS',   selectedAgent.totalTokens.toLocaleString()],
              ] as [string,string][]).map(([l,v]) => (
                <div key={l} className="ov-detail-row">
                  <span>{l}</span>
                  <span style={{ color:'#c9d1d9', textAlign:'right', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Mobile Bottom Sheet ── */}
        <BottomSheet agent={sheetAgent} open={sheetOpen} onClose={closeSheet}/>
      </div>
    </>
  );
}
