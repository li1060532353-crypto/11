import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const preview = 'Preview';
const production = 'Production';
const requiredVars = ['CF_ACCESS_TEAM_DOMAIN', 'CF_ACCESS_AUD', 'LOCAL_AUTH_BYPASS'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function fail(message) { throw new Error(message); }
function parse(source) { let output = ''; for (let index = 0, quote = false, escape = false; index < source.length; index += 1) { const character = source[index]; const next = source[index + 1]; if (quote) { output += character; if (!escape && character === '"') quote = false; escape = !escape && character === '\\'; if (character !== '\\') escape = false; continue; } if (character === '"') { quote = true; output += character; continue; } if (character === '/' && next === '/') { while (index < source.length && source[index] !== '\n') index += 1; output += '\n'; continue; } if (character === '/' && next === '*') { const end = source.indexOf('*/', index + 2); if (end === -1) fail('Configuration is not valid JSONC.'); index = end + 1; continue; } output += character; } try { return JSON.parse(output.replace(/,\s*([}\]])/gu, '$1')); } catch { fail('Configuration is not valid JSONC.'); } }
function resource(config, field, binding, environment) { const matches = Array.isArray(config[field]) ? config[field].filter((item) => item?.binding === binding) : []; if (matches.length !== 1) fail(`${environment} must define exactly one ${binding} ${field === 'd1_databases' ? 'D1' : 'R2'} binding.`); return matches[0]; }
function vars(config, environment) { if (!config.vars || typeof config.vars !== 'object') fail(`${environment} must define Access variables.`); for (const name of requiredVars) { if (typeof config.vars[name] !== 'string' || !config.vars[name].trim()) fail(`${environment} is missing ${name}.`); } if (config.vars.LOCAL_AUTH_BYPASS !== 'false') fail(`${environment} LOCAL_AUTH_BYPASS must be false.`); }
function secrets(value) { if (!value || typeof value !== 'object') return false; return Object.entries(value).some(([key, child]) => /secret|token|api[_-]?key|cloudflare[_-]?email/iu.test(key) || secrets(child)); }
function validId(value, environment) { if (typeof value !== 'string' || value.includes('REPLACE_WITH_') || !uuid.test(value)) fail(`${environment} D1 ID must be a concrete UUID, not a placeholder.`); }

export function validateWranglerConfig(source) {
  if (source.includes('REPLACE_WITH_')) fail('Configuration contains deployment placeholders and must not be used.');
  const config = parse(source);
  if (!config || typeof config !== 'object' || config.name !== '11' || config.pages_build_output_dir !== './apps/web/dist' || config.compatibility_date !== '2026-07-18' || !Array.isArray(config.compatibility_flags) || !config.compatibility_flags.includes('nodejs_compat')) fail('Configuration must describe Pages project 11 with the approved build output and compatibility settings.');
  if (secrets(config)) fail('Committed configuration contains a prohibited secret field.');
  if (!config.env?.preview || typeof config.env.preview !== 'object' || config.env.production) fail('Configuration has an ambiguous deployment target: Pages Production must be top-level and Preview must be env.preview.');
  const productionDb = resource(config, 'd1_databases', 'DB', production); const previewDb = resource(config.env.preview, 'd1_databases', 'DB', preview);
  const productionR2 = resource(config, 'r2_buckets', 'KB_ASSETS', production); const previewR2 = resource(config.env.preview, 'r2_buckets', 'KB_ASSETS', preview);
  validId(previewDb.database_id, preview); validId(productionDb.database_id, production);
  if (previewDb.database_id === productionDb.database_id) fail('Preview and Production must use different D1 database IDs.');
  if (typeof previewR2.bucket_name !== 'string' || !previewR2.bucket_name || typeof productionR2.bucket_name !== 'string' || !productionR2.bucket_name) fail('Preview and Production R2 bucket names are required.');
  if (previewR2.bucket_name === productionR2.bucket_name) fail('Preview and Production must use different R2 bucket names.');
  if (productionDb.database_name !== 'personal-blog-db' || previewDb.database_name !== 'personal-blog-db-preview') fail('Production and Preview D1 database names do not match the approved mapping.');
  if (productionR2.bucket_name !== 'personal-blog-assets' || previewR2.bucket_name !== 'personal-blog-assets-preview') fail('Production and Preview R2 bucket names do not match the approved mapping.');
  vars(config, production); vars(config.env.preview, preview);
  return { previewReady: true, remoteIdentifiersPresent: true, remoteResourcesVerified: false };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const configPath = process.argv[2] ?? 'wrangler.jsonc';
  const source = await readFile(configPath, 'utf8');
  const result = validateWranglerConfig(source);
  process.stdout.write(`${configPath} is structurally ready for a later targeted Preview deployment; remote resource existence is not asserted.\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
