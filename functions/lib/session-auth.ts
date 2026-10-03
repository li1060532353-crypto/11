import type { D1Database } from '@cloudflare/workers-types';
export type OwnerConfig = { username: string; salt: string; hash: string; iterations: number; version: string };
export type SessionEnv = { DB: D1Database; OWNER_LOGIN_CONFIG?: string };
const cookieName = '__Host-owner_session';
const lifetime = 12 * 60 * 60;
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
export async function sessionDigest(value: string) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))); }
export function ownerConfig(env: SessionEnv): OwnerConfig | null {
  try {
    const c = JSON.parse(env.OWNER_LOGIN_CONFIG ?? '') as OwnerConfig;
    return typeof c.username === 'string' && c.username.length > 0 && c.username.length <= 80 && /^[a-f0-9]{32,64}$/.test(c.salt) && /^[a-f0-9]{64}$/.test(c.hash) && c.iterations === 100000 && typeof c.version === 'string' && c.version.length > 0 ? c : null;
  } catch { return null; }
}
export async function passwordHash(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const saltBytes = Uint8Array.from(salt.match(/../g) ?? [], b => parseInt(b,16));
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations }, key, 256));
}
export async function verifyPassword(password: string, config: OwnerConfig): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(config.hash) || !/^[a-f0-9]{32,64}$/.test(config.salt) || config.iterations !== 100000) return false;
  const actual = await passwordHash(password, config.salt, config.iterations);
  let different = 0;
  for (let i=0; i<64; i++) different |= actual.charCodeAt(i) ^ config.hash.charCodeAt(i);
  return different === 0;
}
export function sameOrigin(request: Request): boolean { return request.headers.get('Origin') === new URL(request.url).origin; }
function tokenFrom(request: Request): string | null {
  const value = (request.headers.get('Cookie') ?? '').split(';').map(p=>p.trim()).find(p=>p.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export async function getSession(request: Request, env: SessionEnv): Promise<{username:string} | null> {
  const config = ownerConfig(env);
  const token = tokenFrom(request);
  if (!config || !token) return null;
  const row = await env.DB.prepare('SELECT credential_version FROM owner_sessions WHERE token_hash=? AND expires_at>?').bind(await sessionDigest(token), Date.now()).first<{credential_version:string}>();
  return row?.credential_version === config.version ? {username:config.username} : null;
}
function reply(data: unknown, status=200, cookie?: string) {
  return Response.json(data, { status, headers: { 'Cache-Control':'no-store', ...(cookie ? {'Set-Cookie':cookie}: {}) } });
}
const error = (code:string,message:string,status:number) => reply({success:false,error:{code,message}},status);
const cookie = (value:string, maxAge:number) => `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
export async function handleAuthRequest(request: Request, env: SessionEnv, action: string): Promise<Response> {
  if (action === 'session' && request.method === 'GET') return reply({success:true,data:{authenticated:Boolean(await getSession(request,env))}});
  if (request.method !== 'POST' || !['login','logout'].includes(action)) return error('METHOD_NOT_ALLOWED','Method not allowed',405);
  if (!sameOrigin(request)) return error('ORIGIN_DENIED','Cross-site requests are not allowed',403);
  if (action === 'logout') {
    const token = tokenFrom(request);
    if (token) await env.DB.prepare('DELETE FROM owner_sessions WHERE token_hash=?').bind(await sessionDigest(token)).run();
    return reply({success:true,data:{}},200,cookie('',0));
  }
  const config = ownerConfig(env);
  if (!config) return error('AUTH_CONFIGURATION_INVALID','Login is not configured',503);
  if (!(request.headers.get('Content-Type') ?? '').startsWith('application/json')) return error('VALIDATION_ERROR','JSON request required',400);
  const reader=request.body?.getReader();
  const chunks:Uint8Array[]=[];let length=0;
  if(reader) {
    while(true) {
      const chunk=await reader.read();if(chunk.done)break;
      length+=chunk.value.byteLength;
      if(length>4096) {await reader.cancel();return error('VALIDATION_ERROR','Request is too large',413);}
      chunks.push(chunk.value);
    }
  }
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const raw=new TextDecoder().decode(bytes);
  let input: {username?:unknown;password?:unknown};
  try { input=JSON.parse(raw); } catch { return error('VALIDATION_ERROR','Invalid request',400); }
  if (!input || typeof input.username !== 'string' || typeof input.password !== 'string' || input.username.length>80 || input.password.length>512) return error('VALIDATION_ERROR','Invalid credentials format',400);
  const now=Date.now();
  const windowStart=now-15*60*1000;
  const ipKey=await sessionDigest(request.headers.get('CF-Connecting-IP') ?? 'local');
  const limits=[{key:ipKey,max:10},{key:'global',max:100}];
  const statements=limits.map(({key})=>env.DB.prepare('INSERT INTO owner_login_limits (key, attempts, window_start) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window_start<? THEN 1 ELSE attempts+1 END, window_start=CASE WHEN window_start<? THEN ? ELSE window_start END RETURNING attempts').bind(key,now,windowStart,windowStart,now));
  const counts=await env.DB.batch<{attempts:number}>(statements);
  if (counts.some((result,i)=>Number(result.results[0]?.attempts ?? 1000)>limits[i]!.max)) return error('LOGIN_RATE_LIMITED','Too many login attempts. Try again in 15 minutes.',429);
  const passwordOK=await verifyPassword(input.password,config);
  if (!passwordOK || input.username !== config.username) return error('INVALID_CREDENTIALS','Username or password is incorrect',401);
  const token=random();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM owner_sessions WHERE expires_at<=? OR credential_version<>?').bind(now,config.version),
    env.DB.prepare('DELETE FROM owner_login_limits WHERE window_start<?').bind(windowStart),
    env.DB.prepare('INSERT INTO owner_sessions (token_hash,credential_version,expires_at) VALUES (?,?,?)').bind(await sessionDigest(token),config.version,now+lifetime*1000),
  ]);
  return reply({success:true,data:{authenticated:true,username:config.username}},200,cookie(token,lifetime));
}
