'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Cpu, HardDrive, MemoryStick, Users, Clock,
  AlertCircle, Building2, FolderOpen, Calendar, Settings,
} from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtGB(bytes: number) {
  return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
}
function fmtPct(n: number) {
  return n.toFixed(1) + '%';
}

// ── Types ────────────────────────────────────────────────────────────────────
interface Resources {
  cpu: number;
  ramUsed: number;
  ramTotal: number;
  diskUsed: number;
  diskTotal: number;
}

interface SessionCounts {
  agents: number;
  sessions: number;
}

// ── Skeleton bar ─────────────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = 14 }: { w?: string | number; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 4,
      background: '#21262d',
      animation: 'mc-pulse 1.6s ease-in-out infinite',
    }}/>
  );
}

// ── Resource Card ─────────────────────────────────────────────────────────────
function ResourceCard({
  icon, label, value, sub, pct, color, loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  pct: number;
  color: string;
  loading: boolean;
}) {
  return (
    <div style={{
      flex: '1 1 200px',
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: 10,
      padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: color + '18', border: `1px solid ${color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
        </div>
      </div>

      {loading ? (
        <>
          <Skeleton w="60%" h={20}/>
          <div style={{ marginTop: 8 }}><Skeleton h={6}/></div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#c9d1d9', marginBottom: 4 }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 10 }}>{sub}</div>}
          <div style={{ height: 6, borderRadius: 3, background: '#21262d', overflow: 'hidden', marginTop: sub ? 0 : 10 }}>
            <div style={{
              height: '100%', width: `${Math.min(pct, 100)}%`, borderRadius: 3,
              background: color, transition: 'width 0.6s ease',
            }}/>
          </div>
          <div style={{ fontSize: 10, color: '#8b949e', marginTop: 5, textAlign: 'right' }}>
            {fmtPct(pct)}
          </div>
        </>
      )}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, color, loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  loading: boolean;
}) {
  return (
    <div style={{
      flex: '1 1 140px',
      background: '#161b22',
      border: '1px solid #30363d',
      borderTop: `3px solid ${color}`,
      borderRadius: 10,
      padding: '16px 18px',
    }}>
      <div style={{ color, marginBottom: 10 }}>{icon}</div>
      {loading ? <Skeleton w="50%" h={28}/> : (
        <div style={{ fontSize: 28, fontWeight: 700, color: '#c9d1d9', lineHeight: 1 }}>
          {value}
        </div>
      )}
      <div style={{ fontSize: 11, color: '#8b949e', marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
    </div>
  );
}

// ── Nav Tile ──────────────────────────────────────────────────────────────────
function NavTile({
  href, icon, label, color,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => router.push(href)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: '1 1 180px',
        minHeight: 120,
        background: hovered ? '#1c2128' : '#161b22',
        border: '1px solid #30363d',
        borderLeft: `4px solid ${color}`,
        borderRadius: 10,
        padding: '20px 22px',
        cursor: 'pointer',
        transition: 'background 0.15s, transform 0.15s',
        transform: hovered ? 'translateY(-2px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ color, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#c9d1d9', letterSpacing: 0.3 }}>{label}</div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [resources, setResources] = useState<Resources | null>(null);
  const [sessionCounts, setSessionCounts] = useState<SessionCounts | null>(null);
  const [resLoading, setResLoading] = useState(true);
  const [sesLoading, setSesLoading] = useState(true);

  const fetchResources = useCallback(async () => {
    try {
      const r = await fetch('/api/system/resources');
      if (!r.ok) throw new Error();
      const d = await r.json();
      setResources(d);
    } catch {
      // keep previous or null
    } finally {
      setResLoading(false);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const r = await fetch('/api/openclaw/sessions?activeMinutes=10');
      if (!r.ok) throw new Error();
      const d = await r.json();
      const sessions: Array<{ key?: string; updatedAt?: number }> = d.sessions || [];
      const now = Date.now();
      const active = sessions.filter(s => (now - (s.updatedAt || 0)) < 10 * 60 * 1000);
      const agentIds = new Set(active.map(s => s.key?.split(':')[1]).filter(Boolean));
      setSessionCounts({ agents: agentIds.size, sessions: active.length });
    } catch {
      setSessionCounts({ agents: 0, sessions: 0 });
    } finally {
      setSesLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchResources();
    fetchSessions();
  }, [fetchResources, fetchSessions]);

  // Poll resources every 10s
  useEffect(() => {
    const t = setInterval(fetchResources, 10_000);
    return () => clearInterval(t);
  }, [fetchResources]);

  // Poll sessions every 30s
  useEffect(() => {
    const t = setInterval(fetchSessions, 30_000);
    return () => clearInterval(t);
  }, [fetchSessions]);

  const ramPct  = resources ? (resources.ramUsed / resources.ramTotal) * 100 : 0;
  const diskPct = resources ? (resources.diskUsed / resources.diskTotal) * 100 : 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1117',
      color: '#c9d1d9',
      fontFamily: 'var(--font-jetbrains-mono, JetBrains Mono, monospace)',
      padding: '32px 24px',
      boxSizing: 'border-box',
    }}>
      <style>{`
        @keyframes mc-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        /* Nav tiles — mobile 2-col grid */
        @media (max-width: 640px) {
          .mc-nav-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 12px !important;
          }
        }
      `}</style>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#c9d1d9', margin: 0, letterSpacing: -0.5 }}>
          Mission Control
        </h1>
        <p style={{ fontSize: 13, color: '#8b949e', margin: '6px 0 0' }}>System Overview</p>
      </div>

      {/* ── Resources Row ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
          Resources
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <ResourceCard
            icon={<Cpu size={18}/>}
            label="CPU"
            value={resLoading ? '—' : fmtPct(resources?.cpu ?? 0)}
            pct={resources?.cpu ?? 0}
            color="#58a6ff"
            loading={resLoading}
          />
          <ResourceCard
            icon={<MemoryStick size={18}/>}
            label="RAM"
            value={resLoading ? '—' : fmtGB(resources?.ramUsed ?? 0)}
            sub={resLoading ? undefined : `of ${fmtGB(resources?.ramTotal ?? 0)}`}
            pct={ramPct}
            color="#a78bfa"
            loading={resLoading}
          />
          <ResourceCard
            icon={<HardDrive size={18}/>}
            label="Disk"
            value={resLoading ? '—' : fmtGB(resources?.diskUsed ?? 0)}
            sub={resLoading ? undefined : `of ${fmtGB(resources?.diskTotal ?? 0)}`}
            pct={diskPct}
            color="#34d399"
            loading={resLoading}
          />
        </div>
      </div>

      {/* ── Agents Row ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
          Agents &amp; Activity
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <StatCard
            icon={<Users size={20}/>}
            label="Active Agents"
            value={sesLoading ? '—' : sessionCounts?.agents ?? 0}
            color="#58a6ff"
            loading={sesLoading}
          />
          <StatCard
            icon={<Clock size={20}/>}
            label="Active Sessions"
            value={sesLoading ? '—' : sessionCounts?.sessions ?? 0}
            color="#a78bfa"
            loading={sesLoading}
          />
          <StatCard
            icon={<Calendar size={20}/>}
            label="Cron Jobs"
            value={11}
            color="#34d399"
            loading={false}
          />
          <StatCard
            icon={<AlertCircle size={20}/>}
            label="Errors"
            value={0}
            color="#6b7280"
            loading={false}
          />
        </div>
      </div>

      {/* ── Quick Nav ── */}
      <div>
        <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
          Quick Navigation
        </div>
        <div
          className="mc-nav-grid"
          style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}
        >
          <NavTile href="/workspace" icon={<FolderOpen size={24}/>} label="Workspaces"  color="#58a6ff"/>
          <NavTile href="/office"    icon={<Building2  size={24}/>} label="The Office"  color="#a78bfa"/>
          <NavTile href="/planning"  icon={<Calendar   size={24}/>} label="Planning"    color="#34d399"/>
          <NavTile href="/settings"  icon={<Settings   size={24}/>} label="Settings"    color="#f59e0b"/>
        </div>
      </div>
    </div>
  );
}
