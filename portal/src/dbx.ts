// Dropbox, from the portal: Cody connects his Dropbox once (OAuth, through Dropbox's own sign-in
// page) and the portal keeps a refresh token in KV. Cabinet Studio's Dropbox connector can only
// write text files, so photos taken on the phone come here as bytes and the portal uploads them
// into the client's folder.
//
// Secrets in Cloudflare: DBX_APP_KEY and DBX_APP_SECRET from Cody's app at dropbox.com/developers
// (scoped access, Full Dropbox, permissions files.content.write and account_info.read).
import type { Env } from './store';
import { randomToken } from './store';

export interface DbxConn {
  refresh: string;
  access?: string; accessExp?: number;
  /** Who connected, and the namespace paths like /CJC/Jobs are relative to (a team space's root). */
  name?: string; email?: string;
  rootNs?: string; homeNs?: string;
  connectedAt: number;
}

export const dbxReady = (env: Env) => Boolean(env.DBX_APP_KEY && env.DBX_APP_SECRET);
export const dbxRedirect = (origin: string) => `${origin}/dropbox/callback`;
export const getDbx = async (env: Env) => (await env.PORTAL.get('dbx', 'json')) as DbxConn | null;
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';

/** Start connecting: a one-time state value, then Dropbox's sign-in page. */
export async function dbxConnectUrl(env: Env, origin: string): Promise<string> {
  const state = randomToken(18);
  await env.PORTAL.put(`dbxstate:${state}`, JSON.stringify(Date.now() + 10 * 60e3));
  const q = new URLSearchParams({ client_id: env.DBX_APP_KEY!, response_type: 'code', token_access_type: 'offline', redirect_uri: dbxRedirect(origin), state });
  return `https://www.dropbox.com/oauth2/authorize?${q}`;
}

async function tokenCall(env: Env, body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { authorization: `Basic ${btoa(`${env.DBX_APP_KEY}:${env.DBX_APP_SECRET}`)}`, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Dropbox sign-in failed: ${j.error_description || j.error || res.status}`);
  return j as { access_token: string; refresh_token?: string; expires_in: number };
}

/** Dropbox sends Cody back here after he approves. */
export async function dbxFinish(env: Env, url: URL): Promise<DbxConn> {
  const state = url.searchParams.get('state') || '';
  const exp = (await env.PORTAL.get(`dbxstate:${state}`, 'json')) as number | null;
  await env.PORTAL.delete(`dbxstate:${state}`);
  if (!exp || exp < Date.now()) throw new Error('That connect link expired. Start again from the Dropbox page.');
  if (url.searchParams.get('error')) throw new Error(`Dropbox said: ${url.searchParams.get('error_description') || url.searchParams.get('error')}`);
  const t = await tokenCall(env, { grant_type: 'authorization_code', code: url.searchParams.get('code') || '', redirect_uri: dbxRedirect(url.origin) });
  if (!t.refresh_token) throw new Error('Dropbox didn’t give the portal lasting access. Try again.');
  const conn: DbxConn = { refresh: t.refresh_token, access: t.access_token, accessExp: Date.now() + (t.expires_in - 60) * 1000, connectedAt: Date.now() };
  // Team accounts keep shared folders like /CJC outside the member's home; paths are read from the root
  const acct = await api(conn, 'users/get_current_account', null);
  conn.name = acct.name?.display_name; conn.email = acct.email;
  conn.rootNs = acct.root_info?.root_namespace_id; conn.homeNs = acct.root_info?.home_namespace_id;
  await env.PORTAL.put('dbx', JSON.stringify(conn));
  return conn;
}

export const dbxDisconnect = (env: Env) => env.PORTAL.delete('dbx');

async function accessToken(env: Env, conn: DbxConn): Promise<string> {
  if (conn.access && (conn.accessExp ?? 0) > Date.now()) return conn.access;
  const t = await tokenCall(env, { grant_type: 'refresh_token', refresh_token: conn.refresh });
  conn.access = t.access_token; conn.accessExp = Date.now() + (t.expires_in - 60) * 1000;
  await env.PORTAL.put('dbx', JSON.stringify(conn));
  return conn.access;
}

const rootHeader = (conn: DbxConn): Record<string, string> =>
  conn.rootNs && conn.rootNs !== conn.homeNs ? { 'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', root: conn.rootNs }) } : {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api(conn: DbxConn, endpoint: string, body: unknown): Promise<any> {
  const res = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${conn.access}`, ...(body === null ? {} : { 'content-type': 'application/json' }), ...rootHeader(conn) },
    body: body === null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Dropbox: ${text.slice(0, 200) || res.status}`);
  return text ? JSON.parse(text) : {};
}

/** Header values must be ASCII; Dropbox wants anything else escaped. */
const asciiJson = (v: unknown) => JSON.stringify(v).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

/**
 * Upload one file into a folder, never replacing anything: a name already taken gets " (1)" and so on.
 * Dropbox makes the folder if it isn't there.
 */
export async function dbxUpload(env: Env, folder: string, name: string, bytes: Uint8Array): Promise<{ path: string; size: number }> {
  const conn = await getDbx(env);
  if (!conn) throw new Error('Dropbox isn’t connected to the portal yet. Open the portal’s /dropbox page to connect it.');
  const token = await accessToken(env, conn);
  const clean = (s: string) => s.replace(/[\\:*?"<>|]/g, '-').trim();
  const path = `/${folder.split('/').filter(Boolean).map(clean).join('/')}/${clean(name)}`;
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream', 'Dropbox-API-Arg': asciiJson({ path, mode: 'add', autorename: true, mute: true }), ...rootHeader(conn) },
    body: bytes,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Dropbox didn’t take the photo: ${text.slice(0, 200) || res.status}`);
  const j = JSON.parse(text) as { path_display: string; size: number };
  return { path: j.path_display, size: j.size };
}
