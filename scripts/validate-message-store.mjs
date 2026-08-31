import path from 'node:path';

import { parseArgs, sanitizedError } from './lib/nx-interface.mjs';
import { validateStoreRoot } from './lib/message-store.mjs';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.root) throw new Error('missing_root');
  const result = await validateStoreRoot(path.resolve(options.root));
  console.log(JSON.stringify({
    status: 'VALID_CANDIDATE', store_id: result.manifest.store_id,
    messages: result.index.messages.length, next_sequence: result.index.next_sequence,
    lifecycle: result.index.status
  }));
}

main().catch((error) => { console.error(`MESSAGE STORE ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
