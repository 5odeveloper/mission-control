'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Zap, User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirectTo   = searchParams.get('from') || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw  ] = useState(false);
  const [loading,  setLoading ] = useState(false);
  const [error,    setError   ] = useState('');
  const [shake,    setShake   ] = useState(false);

  useEffect(() => {
    fetch('/api/auth/verify')
      .then(r => { if (r.ok) router.replace(redirectTo); })
      .catch(() => {});
  }, [router, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.replace(redirectTo);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Invalid username or password');
        setShake(true);
        setTimeout(() => setShake(false), 600);
        setPassword('');
      }
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputBase: React.CSSProperties = {
    width: '100%', background: '#0d1117',
    border: '1px solid #30363d', borderRadius: 8,
    padding: '12px 44px', color: '#c9d1d9', fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', transition: 'border-color 0.2s',
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0d1117',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: 'var(--font-jetbrains-mono, monospace)',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'fixed', inset: 0, opacity: 0.03, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(#58a6ff 1px,transparent 1px),linear-gradient(90deg,#58a6ff 1px,transparent 1px)',
        backgroundSize: '40px 40px',
      }}/>

      <div className={shake ? 'login-shake' : ''} style={{
        width: '100%', maxWidth: 420,
        background: '#161b22', border: '1px solid #30363d',
        borderRadius: 12, padding: '40px 36px',
        position: 'relative', zIndex: 1,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Zap style={{ width: 28, height: 28, color: '#58a6ff' }}/>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#c9d1d9', margin: '0 0 6px' }}>
            Mission Control
          </h1>
          <p style={{ fontSize: 13, color: '#8b949e', margin: 0 }}>
            Sign in to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Username */}
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#8b949e', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#8b949e', pointerEvents:'none' }}>
                <User style={{ width:16, height:16 }}/>
              </div>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="username"
                autoFocus
                autoCapitalize="none"
                autoComplete="username"
                style={{ ...inputBase, borderColor: error ? '#f85149' : '#30363d' }}
                onFocus={e => { if (!error) e.target.style.borderColor = '#58a6ff'; }}
                onBlur={e =>  { if (!error) e.target.style.borderColor = '#30363d'; }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#8b949e', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#8b949e', pointerEvents:'none' }}>
                <Lock style={{ width:16, height:16 }}/>
              </div>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                style={{ ...inputBase, borderColor: error ? '#f85149' : '#30363d' }}
                onFocus={e => { if (!error) e.target.style.borderColor = '#58a6ff'; }}
                onBlur={e =>  { if (!error) e.target.style.borderColor = '#30363d'; }}
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#8b949e', padding:4 }}>
                {showPw ? <EyeOff style={{ width:16, height:16 }}/> : <Eye style={{ width:16, height:16 }}/>}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display:'flex', alignItems:'center', gap:8,
              background:'rgba(248,81,73,0.1)', border:'1px solid rgba(248,81,73,0.3)',
              borderRadius:8, padding:'10px 12px', color:'#f85149', fontSize:13,
            }}>
              <AlertCircle style={{ width:14, height:14, flexShrink:0 }}/>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            style={{
              width:'100%', padding:'13px',
              background: loading ? '#388bfd44' : '#238636',
              border: `1px solid ${loading ? '#388bfd44' : '#2ea043'}`,
              borderRadius:8, color:'#c9d1d9',
              fontSize:14, fontWeight:600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily:'inherit', transition:'all 0.2s',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              marginTop: 4,
            }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#2ea043'; }}
            onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#238636'; }}
          >
            {loading ? (
              <>
                <span style={{ width:14, height:14, border:'2px solid #c9d1d9', borderTopColor:'transparent', borderRadius:'50%', display:'inline-block', animation:'spin 0.8s linear infinite' }}/>
                Authenticating...
              </>
            ) : 'Sign In →'}
          </button>
        </form>

        {/* spacer */}
        <div style={{ marginTop: 8 }} />
      </div>

      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes login-shake {
          0%,100% { transform:translateX(0); }
          20%,60%  { transform:translateX(-8px); }
          40%,80%  { transform:translateX(8px); }
        }
        .login-shake { animation:login-shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100vh', background:'#0d1117', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ color:'#58a6ff', fontSize:14, fontFamily:'monospace' }}>Loading...</div>
      </div>
    }>
      <LoginForm/>
    </Suspense>
  );
}
