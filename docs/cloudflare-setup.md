# Cloudflare Pages Knowledge-Base Setup

This runbook is intentionally not executable until H2 approval. It does not contain secrets.

1. In Workers & Pages, create one D1 database and one R2 bucket. Keep the R2 bucket private; do not enable a public bucket URL.
2. Copy `wrangler.example.jsonc` to `wrangler.jsonc`, replace every `REPLACE_WITH_*` value with dashboard values, run `pnpm cloudflare:verify-config`, and review it before deployment. A checked-in Wrangler file becomes Pages configuration source of truth.
3. In Workers & Pages > the Pages project > Settings > Bindings, add the D1 database as `DB` and R2 bucket as `KB_ASSETS` for both Production and Preview. Redeploy after each binding change. `ASSETS` is reserved by Pages and must not be used.
4. Apply `migrations/0001_knowledge_base.sql` through Wrangler. Before content import, export/back up D1 and retain the backup outside the repository.
5. In Zero Trust > Access > Applications, add a Self-hosted application for the production `https://<project>.pages.dev` hostname and create an Allow policy for exactly the owner email/identity. Add a separate preview hostname/policy as needed. Preview protection does not protect production.
6. In the Pages project > Settings > Variables and Secrets, set `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` for both Production and Preview; set `LOCAL_AUTH_BYPASS=false` for both. The audience is the Access application AUD tag, not an email.
7. Redeploy. In a private browser window, verify the Access login challenge; then verify an authenticated API request succeeds and a direct unauthenticated `/api/*` request receives HTTP 403.

The Functions middleware validates the `Cf-Access-Jwt-Assertion` signature through the team JWKS, issuer, and audience. Browser cookies or frontend-supplied identity fields are not accepted as proof.

For local development, copy `.dev.vars.example` to `.dev.vars`, set only `LOCAL_AUTH_BYPASS=true`, copy the Wrangler template with local resource values, build the web application, run `pnpm d1:migrate:local`, then run `pnpm pages:dev`. Never deploy template placeholders. The legacy Nest API remains under `/api/v1`; all new knowledge-base Functions use `/api`, so frontend integration must use a separate client base path.
