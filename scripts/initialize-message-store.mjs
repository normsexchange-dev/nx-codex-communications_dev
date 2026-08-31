import path from 'node:path';

import { parseArgs, sanitizedError } from './lib/nx-interface.mjs';
import { initializeStoreRoot } from './lib/message-store.mjs';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  for (const key of ['output', 'group-id', 'publisher-environment', 'publisher-repository', 'created-at']) {
    if (!options[key]) throw new Error(`missing_${key}`);
  }
  const result = await initializeStoreRoot(path.resolve(options.output), {
    groupId: options['group-id'], publisherEnvironment: options['publisher-environment'],
    publisherRepository: options['publisher-repository'], createdAt: options['created-at'],
    defaultPollSeconds: options['default-poll-seconds'] ? Number(options['default-poll-seconds']) : 900
  });
  console.log(JSON.stringify({
    status: 'INITIALIZED_EMPTY_CANDIDATE', store_id: result.manifest.store_id,
    repository: result.manifest.publisher.repository, next_sequence: result.index.next_sequence
  }));
}

main().catch((error) => { console.error(`MESSAGE STORE ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
