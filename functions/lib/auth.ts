import { createRemoteJWKSet, jwtVerify } from 'jose';

export type AccessEnvironment = {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  LOCAL_AUTH_BYPASS?: string;
};

export type AccessDecision = { allowed: true } | { allowed: false; code: string };

type VerifyAccessAssertion = (token: string, env: AccessEnvironment) => Promise<void>;

const jwksByTeamDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function authorizeApiRequest(
  request: Request,
  env: AccessEnvironment,
  isLocalDevelopment: boolean,
  verifyAccessAssertion: VerifyAccessAssertion = verifyAccessAssertionJwt,
): Promise<AccessDecision> {
  if (isLocalDevelopment && env.LOCAL_AUTH_BYPASS === 'true') {
    return { allowed: true };
  }

  const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!assertion) return { allowed: false, code: 'ACCESS_DENIED' };

  if (!isValidAccessEnvironment(env)) {
    return { allowed: false, code: 'ACCESS_CONFIGURATION_INVALID' };
  }

  try {
    await verifyAccessAssertion(assertion, env);
    return { allowed: true };
  } catch {
    return { allowed: false, code: 'ACCESS_DENIED' };
  }
}

function isValidAccessEnvironment(
  env: AccessEnvironment,
): env is Required<Pick<AccessEnvironment, 'CF_ACCESS_TEAM_DOMAIN' | 'CF_ACCESS_AUD'>> {
  return Boolean(env.CF_ACCESS_TEAM_DOMAIN?.trim() && env.CF_ACCESS_AUD?.trim());
}

async function verifyAccessAssertionJwt(token: string, env: AccessEnvironment): Promise<void> {
  if (!isValidAccessEnvironment(env)) throw new Error('Access configuration is missing');

  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN.trim().toLowerCase();
  const issuer = `https://${teamDomain}`;
  const jwks = getJwks(teamDomain);

  await jwtVerify(token, jwks, { issuer, audience: env.CF_ACCESS_AUD.trim() });
}

function getJwks(teamDomain: string): ReturnType<typeof createRemoteJWKSet> {
  const existing = jwksByTeamDomain.get(teamDomain);
  if (existing) return existing;

  const jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
  jwksByTeamDomain.set(teamDomain, jwks);
  return jwks;
}

export function isLocalDevelopmentRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}
