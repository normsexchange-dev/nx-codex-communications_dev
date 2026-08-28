import path from 'node:path';

import { parseArgs, readJson, sanitizedError } from './lib/nx-interface.mjs';
import { proposeMessage } from './lib/pairwise-channel.mjs';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  for (const key of ['channel-root', 'draft', 'proposal']) if (!options[key]) throw new Error(`missing_${key}`);
  const result = await proposeMessage(path.resolve(options['channel-root']), await readJson(path.resolve(options.draft)), path.resolve(options.proposal));
  console.log(JSON.stringify({ status: 'PROPOSED_NOT_PUBLISHED', path: result.message_path, sha256: result.message_sha256 }));
}

main().catch((error) => { console.error(`PAIRWISE ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
