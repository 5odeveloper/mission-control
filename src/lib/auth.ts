export const AUTH_COOKIE   = 'mc-session';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/** Derive a session token from username + password (Web Crypto, Edge-safe) */
export async function deriveSessionToken(username: string, password: string): Promise<string> {
  const enc  = new TextEncoder();
  const key  = await crypto.subtle.importKey('raw', enc.encode(password),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const data = enc.encode(`mc-ui-session-v1:${username}`);
  const sig  = await crypto.subtle.sign('HMAC', key, data);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getUICredentials(): { username: string; password: string } {
  // MC_UI_PASSWORD_B64 takes priority — avoids dotenv $ interpolation issues
  const rawB64 = process.env.MC_UI_PASSWORD_B64;
  const password = rawB64
    ? Buffer.from(rawB64.trim(), 'base64').toString('utf8')
    : (process.env.MC_UI_PASSWORD || process.env.MC_API_TOKEN || '');
  return {
    username: process.env.MC_UI_USERNAME || 'admin',
    password,
  };
}
