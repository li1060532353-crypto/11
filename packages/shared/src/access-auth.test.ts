import { describe, expect, it, vi } from 'vitest';

import { authorizeApiRequest } from '../../../functions/lib/auth';

const accessEnv = {
  CF_ACCESS_TEAM_DOMAIN: 'owner.cloudflareaccess.com',
  CF_ACCESS_AUD: 'audience-tag',
  LOCAL_AUTH_BYPASS: 'false',
};

describe('authorizeApiRequest', () => {
  it('denies API requests without an Access assertion', async () => {
    await expect(
      authorizeApiRequest(new Request('https://kb.example/api/notes'), accessEnv, false),
    ).resolves.toEqual({ allowed: false, code: 'ACCESS_DENIED' });
  });

  it('fails closed when production Access configuration is absent', async () => {
    await expect(
      authorizeApiRequest(
        new Request('https://kb.example/api/notes', {
          headers: { 'Cf-Access-Jwt-Assertion': 'token' },
        }),
        { ...accessEnv, CF_ACCESS_AUD: '' },
        false,
      ),
    ).resolves.toEqual({ allowed: false, code: 'ACCESS_CONFIGURATION_INVALID' });
  });

  it('allows the explicit bypass only in local development', async () => {
    await expect(
      authorizeApiRequest(
        new Request('http://localhost:8788/api/notes'),
        { ...accessEnv, LOCAL_AUTH_BYPASS: 'true' },
        true,
      ),
    ).resolves.toEqual({ allowed: true });
  });

  it('never enables the bypass in production', async () => {
    await expect(
      authorizeApiRequest(
        new Request('https://kb.example/api/notes'),
        { ...accessEnv, LOCAL_AUTH_BYPASS: 'true' },
        false,
      ),
    ).resolves.toEqual({ allowed: false, code: 'ACCESS_DENIED' });
  });

  it('accepts only a verified Access assertion', async () => {
    const verify = vi.fn().mockResolvedValue(undefined);
    const request = new Request('https://kb.example/api/notes', {
      headers: { 'Cf-Access-Jwt-Assertion': 'verified-token' },
    });

    await expect(authorizeApiRequest(request, accessEnv, false, verify)).resolves.toEqual({
      allowed: true,
    });
    expect(verify).toHaveBeenCalledWith('verified-token', accessEnv);
  });
});
