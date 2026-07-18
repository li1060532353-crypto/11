# Human Actions

## H2 — Cloudflare resources and Access

Required dashboard actions, not yet performed:

1. Create a D1 database and record its database name and ID.
2. Create a private R2 bucket and record its bucket name. Do not enable a public bucket URL.
3. In the existing Pages project, bind the D1 database as `DB` and the R2 bucket as `KB_ASSETS` for both Production and Preview.
4. Create Cloudflare Access applications/policies for the production `<project>.pages.dev` hostname and applicable preview hostname. Add one Allow policy for the owner identity/email.
5. Obtain the Access team domain and application AUD tag; enter them as `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` in both Production and Preview. Set `LOCAL_AUTH_BYPASS=false` in both.
6. Copy `wrangler.example.jsonc` to ignored `wrangler.jsonc`, enter the obtained non-secret resource IDs/names and Access values, then run `pnpm cloudflare:verify-config` before deployment.

Never place passwords, API tokens, private keys, cookies, or complete secret values in this repository or chat.
