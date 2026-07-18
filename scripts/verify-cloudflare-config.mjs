import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export function validateWranglerConfig(source) {
  if (source.includes('REPLACE_WITH_')) {
    throw new Error('Configuration contains deployment placeholders and must not be used.');
  }
  if (!/"binding"\s*:\s*"DB"/.test(source) || !/"binding"\s*:\s*"ASSETS"/.test(source)) {
    throw new Error('Configuration must bind DB and ASSETS.');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const configPath = process.argv[2] ?? 'wrangler.jsonc';
  const source = await readFile(configPath, 'utf8');
  validateWranglerConfig(source);
  process.stdout.write(`${configPath} passes binding and placeholder checks.\n`);
}
