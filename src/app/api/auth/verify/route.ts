import { NextRequest, NextResponse } from 'next/server';
import { deriveSessionToken, getUICredentials, AUTH_COOKIE } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { username, password } = getUICredentials();
  if (!password) return NextResponse.json({ ok: true }); // not configured

  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (!cookie) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const expected = await deriveSessionToken(username, password);
  if (cookie !== expected) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  return NextResponse.json({ ok: true });
}
