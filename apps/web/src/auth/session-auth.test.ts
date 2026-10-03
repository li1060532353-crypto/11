import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { passwordHash, verifyPassword, sameOrigin, sessionDigest, getSession, handleAuthRequest } from '../../../../functions/lib/session-auth';

describe('owner authentication', () => {
  beforeEach(() => vi.stubGlobal('crypto', webcrypto));
  afterEach(() => vi.unstubAllGlobals());
  it('verifies salted passwords and rejects wrong passwords and malformed configuration', async () => {
    const salt = 'ab'.repeat(16);
    const hash = await passwordHash('a-long-test-password', salt, 100000);
    const config = { username: 'admin', salt, hash, iterations: 100000, version: 'v1' };
    expect(await verifyPassword('a-long-test-password', config)).toBe(true);
    expect(await verifyPassword('wrong-password', config)).toBe(false);
    expect(await verifyPassword('a-long-test-password', { ...config, hash: 'bad' })).toBe(false);
  });
  it('requires exact same origin for mutation including login and rejects missing origin', () => {
    const url = 'https://11-9tc.pages.dev/api/auth/login';
    expect(sameOrigin(new Request(url, { headers: { Origin: 'https://11-9tc.pages.dev' } }))).toBe(true);
    expect(sameOrigin(new Request(url, { headers: { Origin: 'https://attacker.test' } }))).toBe(false);
    expect(sameOrigin(new Request(url))).toBe(false);
  });
  it('never authenticates a missing, malformed or revoked cookie', async () => {
    const db = { prepare: vi.fn(() => ({ bind: () => ({ first: async () => null }) })) };
    const env = { DB: db as never, OWNER_LOGIN_CONFIG: JSON.stringify({username:'admin', salt:'ab'.repeat(16),hash:'ab'.repeat(32),iterations:100000,version:'v1'}) };
    expect(await getSession(new Request('https://example.test/api/notes'), env)).toBeNull();
    expect(await getSession(new Request('https://example.test/api/notes', {headers:{Cookie:'__Host-owner_session=bad'}}), env)).toBeNull();
    expect(await getSession(new Request('https://example.test/api/notes', {headers:{Cookie:'__Host-owner_session='+'a'.repeat(64)}}), env)).toBeNull();
    expect(await sessionDigest('a'.repeat(64))).toHaveLength(64);
  });
  it('issues only secure cookies, enforces expiry and revokes sessions on logout and credential rotation', async () => {
    const sessions=new Map<string,{credential_version:string;expires_at:number}>();
    let attempts=0;
    const db={prepare:(sql:string)=>({bind:(...values:unknown[])=>({sql,values,first:async()=>{
      const row=sessions.get(String(values[0]));return row && row.expires_at>Number(values[1]) ? row : null;
    },run:async()=>{sessions.delete(String(values[0]));}})}),batch:async(statements:{sql:string;values:unknown[]}[])=>statements.map(s=>{
      if(s.sql.startsWith('INSERT INTO owner_login_limits'))return {results:[{attempts:++attempts}]};
      if(s.sql.startsWith('INSERT INTO owner_sessions'))sessions.set(String(s.values[0]),{credential_version:String(s.values[1]),expires_at:Number(s.values[2])});
      return {results:[]};
    })};
    const config={username:'admin',salt:'ab'.repeat(16),hash:await passwordHash('correct-password','ab'.repeat(16),100000),iterations:100000,version:'v1'};
    const env={DB:db as never,OWNER_LOGIN_CONFIG:JSON.stringify(config)};
    const login=(password:string,origin='https://example.test')=>new Request('https://example.test/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password})});
    expect((await handleAuthRequest(login('wrong'),env,'login')).status).toBe(401);
    expect((await handleAuthRequest(login('correct-password','https://attacker.test'),env,'login')).status).toBe(403);
    const response=await handleAuthRequest(login('correct-password'),env,'login');
    expect(response.status).toBe(200);
    const cookie=response.headers.get('Set-Cookie')!;
    expect(cookie).toContain('HttpOnly; Secure; SameSite=Lax');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const request=new Request('https://example.test/api/notes',{headers:{Cookie:cookie.split(';')[0]!,Origin:'https://example.test'}});
    expect(await getSession(request,env)).toEqual({username:'admin'});
    expect(await getSession(request,{...env,OWNER_LOGIN_CONFIG:JSON.stringify({...config,version:'v2'})})).toBeNull();
    const row=[...sessions.values()][0]!;
    const expiry=row.expires_at;row.expires_at=0;expect(await getSession(request,env)).toBeNull();row.expires_at=expiry;
    const logout=new Request('https://example.test/api/auth/logout',{method:'POST',headers:request.headers});
    expect((await handleAuthRequest(logout,env,'logout')).headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect(await getSession(request,env)).toBeNull();
    attempts=1000;expect((await handleAuthRequest(login('correct-password'),env,'login')).status).toBe(429);
  });
  it('cancels oversized streaming login bodies before buffering the whole payload', async () => {
    const cancelled=vi.fn();let pulls=0;
    const stream=new ReadableStream({pull(controller){pulls++;controller.enqueue(new Uint8Array(3000));if(pulls===10)controller.close();},cancel:cancelled});
    const request=new Request('https://example.test/api/auth/login',{method:'POST',headers:{Origin:'https://example.test','Content-Type':'application/json'},body:stream,duplex:'half'} as RequestInit & {duplex:string});
    const env={DB:{} as never,OWNER_LOGIN_CONFIG:JSON.stringify({username:'admin',salt:'ab'.repeat(16),hash:'ab'.repeat(32),iterations:100000,version:'v1'})};
    expect((await handleAuthRequest(request,env,'login')).status).toBe(413);
    expect(cancelled).toHaveBeenCalled();
    expect(pulls).toBeLessThan(10);
  });
});
