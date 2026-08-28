import path from 'node:path';

import { parseArgs, sanitizedError } from './lib/nx-interface.mjs';
import { initializeChannelRoot } from './lib/pairwise-channel.mjs';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  for (const key of ['output', 'channel-id', 'publisher-environment', 'publisher-repository', 'recipient-environment', 'reciprocal-repository', 'created-at']) {
    if (!options[key]) throw new Error(`missing_${key}`);
  }
  const result = await initializeChannelRoot(path.resolve(options.output), {
    channelId: options['channel-id'], channelVersion: options['channel-version'] || '0.1.0',
    publisherEnvironment: options['publisher-environment'], publisherRepository: options['publisher-repository'],
    recipientEnvironment: options['recipient-environment'], reciprocalRepository: options['reciprocal-repository'],
    createdAt: options['created-at']
  });
  console.log(JSON.stringify({ status: 'INITIALIZED_EMPTY', channel_id: result.manifest.channel_id, next_sequence: result.index.next_sequence }));
}

main().catch((error) => { console.error(`PAIRWISE ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
