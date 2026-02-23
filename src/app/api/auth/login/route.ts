import { NextRequest, NextResponse } from 'next/server';
import { deriveSessionToken, getUICredentials, AUTH_COOKIE, COOKIE_MAX_AGE } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password, rememberMe = true } = await request.json();
    const creds = getUICredentials();

    if (!creds.password) {
      return NextResponse.json({ error: 'Auth not configured — set MC_UI_PASSWORD' }, { status: 500 });
    }

    // Small delay to slow brute-force regardless of outcome
    await new Promise(r => setTimeout(r, 300));

    if (!username || !password || username !== creds.username || password !== creds.password) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const token = await deriveSessionToken(creds.username, creds.password);

    const res = NextResponse.json({ ok: true });
    // rememberMe=true → 30 days; false → session cookie (expires on browser close)
    const maxAge = rememberMe ? 60 * 60 * 24 * 30 : undefined;
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      ...(maxAge ? { maxAge } : {}),
      path: '/',
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
