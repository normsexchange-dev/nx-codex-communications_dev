import path from 'node:path';

import { parseArgs, sanitizedError } from './lib/nx-interface.mjs';
import { applyStoreProposal } from './lib/message-store.mjs';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  for (const key of ['store-root', 'proposal', 'authority-ref']) if (!options[key]) throw new Error(`missing_${key}`);
  const result = await applyStoreProposal(
    path.resolve(options['store-root']), path.resolve(options.proposal),
    options['authority-ref']
  );
  console.log(JSON.stringify({ ...result, authority_reference_recorded: false, model_invoked: false }));
}

main().catch((error) => { console.error(`MESSAGE STORE ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
