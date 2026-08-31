import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { assert, parseArgs, prettyJson, readJson, sanitizedError } from './lib/nx-interface.mjs';
import { replayParked, scanStore } from './lib/message-store.mjs';

function outsidePublisherRoot(root, output) {
  const relative = path.relative(root, output);
  return relative.startsWith('..') || path.isAbsolute(relative);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  for (const key of ['root', 'state', 'output', 'observed-at']) if (!options[key]) throw new Error(`missing_${key}`);
  const root = path.resolve(options.root);
  const output = path.resolve(options.output);
  assert(outsidePublisherRoot(root, output), 'reader_state_output_inside_publisher_store');
  const supportedSemantics = options.supported
    ? options.supported.split(',').map((item) => item.trim()).filter(Boolean)
    : undefined;
  const current = await readJson(path.resolve(options.state));
  const scanned = await scanStore(root, current, {
    observedAt: options['observed-at'], supportedSemantics
  });
  const replayed = options['replay-parked']
    ? await replayParked(root, scanned.state, {
      observedAt: options['observed-at'], supportedSemantics
    })
    : { state: scanned.state, deliveries: [] };
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, prettyJson(replayed.state), { flag: 'wx' });
  console.log(JSON.stringify({
    status: 'READER_STATE_PROPOSED', new_messages: scanned.deliveries.length,
    replayed_messages: replayed.deliveries.length,
    last_sequence: replayed.state.last_sequence,
    processed: replayed.state.processed.length, parked: replayed.state.parked.length,
    model_invoked: false
  }));
}

main().catch((error) => { console.error(`MESSAGE STORE ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
