import { NextRequest, NextResponse } from 'next/server';

// ── Constants ──────────────────────────────────────────────────────────────
const MC_API_TOKEN   = process.env.MC_API_TOKEN;
const MC_UI_USERNAME = process.env.MC_UI_USERNAME || 'admin';

// MC_UI_PASSWORD_B64 takes priority (avoids dotenv $ interpolation issues)
const _b64 = process.env.MC_UI_PASSWORD_B64;
const MC_UI_PASSWORD = _b64
  ? atob(_b64.trim())
  : (process.env.MC_UI_PASSWORD || MC_API_TOKEN || '');

const DEMO_MODE      = process.env.DEMO_MODE === 'true';
const AUTH_COOKIE    = 'mc-session';

if (!MC_API_TOKEN) {
  console.warn('[SECURITY] MC_API_TOKEN not set — API auth DISABLED');
}
if (DEMO_MODE) {
  console.log('[DEMO] Running in demo mode — all writes blocked');
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Derive expected session token using Web Crypto (Edge-compatible) */
async function expectedToken(username: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`mc-ui-session-v1:${username}`));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Check if request is same-origin browser UI (for API auth) */
function isSameOrigin(request: NextRequest): boolean {
  const host   = request.headers.get('host');
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  if (!host || (!origin && !referer)) return false;
  if (origin) {
    try { if (new URL(origin).host === host) return true; } catch { /* skip */ }
  }
  if (referer) {
    try { if (new URL(referer).host === host) return true; } catch { /* skip */ }
  }
  return false;
}

// ── Middleware ─────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Always pass through ──
  // Static assets, login page, and auth API don't need UI auth check
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/favicon.svg' ||
    pathname === '/login'
  ) {
    return NextResponse.next();
  }

  // ── UI route protection ──
  // For all non-API page requests, check session cookie
  if (!pathname.startsWith('/api/')) {
    // If no password configured, skip UI auth
    if (!MC_UI_PASSWORD) {
      return addDemoHeader(NextResponse.next());
    }

    const sessionCookie = request.cookies.get(AUTH_COOKIE)?.value;

    if (sessionCookie) {
      const expected = await expectedToken(MC_UI_USERNAME, MC_UI_PASSWORD);
      if (sessionCookie === expected) {
        return addDemoHeader(NextResponse.next());
      }
    }

    // Not authenticated — redirect to /login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── API route protection ──
  if (DEMO_MODE) {
    const method = request.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      return NextResponse.json(
        { error: 'Demo mode — read-only instance.' },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  if (!MC_API_TOKEN) return NextResponse.next();
  if (isSameOrigin(request)) return NextResponse.next();

  // SSE stream: allow token as query param
  if (pathname === '/api/events/stream') {
    const queryToken = request.nextUrl.searchParams.get('token');
    if (queryToken === MC_API_TOKEN) return NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authHeader.substring(7) !== MC_API_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
}

function addDemoHeader(res: NextResponse): NextResponse {
  if (DEMO_MODE) res.headers.set('X-Demo-Mode', 'true');
  return res;
}

// Match everything except static files
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
