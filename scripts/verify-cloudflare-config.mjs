import { readFile } from 'node:fs/promises';

const configPath = process.argv[2] ?? 'wrangler.jsonc';
const source = await readFile(configPath, 'utf8');
if (source.includes('REPLACE_WITH_')) {
  throw new Error(`${configPath} contains deployment placeholders and must not be used.`);
}
if (!source.includes('"binding": "DB"') || !source.includes('"binding": "ASSETS"')) {
  throw new Error(`${configPath} must bind DB and ASSETS.`);
}
process.stdout.write(`${configPath} passes binding and placeholder checks.\n`);
