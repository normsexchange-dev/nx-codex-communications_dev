import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parseArgs, readJson, sanitizedError } from './lib/nx-interface.mjs';
import { validateWtbPayloadReference } from './lib/pairwise-channel.mjs';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.reference) throw new Error('missing_reference');
  const payload = options.payload ? await readFile(path.resolve(options.payload)) : null;
  const schema = options.schema ? await readFile(path.resolve(options.schema)) : null;
  const result = validateWtbPayloadReference(await readJson(path.resolve(options.reference)), payload, schema);
  console.log(JSON.stringify(result));
}

main().catch((error) => { console.error(`PAIRWISE ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
