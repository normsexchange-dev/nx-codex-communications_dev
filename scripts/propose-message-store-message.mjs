import path from 'node:path';

import { parseArgs, readJson, sanitizedError } from './lib/nx-interface.mjs';
import { proposeStoreMessage } from './lib/message-store.mjs';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  for (const key of ['store-root', 'draft', 'proposal']) if (!options[key]) throw new Error(`missing_${key}`);
  const result = await proposeStoreMessage(
    path.resolve(options['store-root']), await readJson(path.resolve(options.draft)),
    path.resolve(options.proposal)
  );
  console.log(JSON.stringify({
    status: 'PROPOSED_NOT_PUBLISHED', path: result.message_path,
    sha256: result.message_sha256, lifecycle: result.index.status
  }));
}

main().catch((error) => { console.error(`MESSAGE STORE ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
