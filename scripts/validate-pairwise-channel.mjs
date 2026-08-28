import path from 'node:path';

import { parseArgs, sanitizedError } from './lib/nx-interface.mjs';
import { validateChannelRoot } from './lib/pairwise-channel.mjs';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.root) throw new Error('missing_root');
  const result = await validateChannelRoot(path.resolve(options.root));
  console.log(JSON.stringify({ status: 'VALID', channel_id: result.manifest.channel_id, messages: result.index.messages.length, next_sequence: result.index.next_sequence }));
}

main().catch((error) => { console.error(`PAIRWISE ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
