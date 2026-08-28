import path from 'node:path';

import { parseArgs, readJson, sanitizedError } from './lib/nx-interface.mjs';
import { createAcknowledgementMessage, proposeMessage, validateChannelRoot } from './lib/pairwise-channel.mjs';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  for (const key of ['channel-root', 'reference', 'proposal', 'message-id', 'created-at', 'status', 'subject', 'summary']) if (!options[key]) throw new Error(`missing_${key}`);
  const root = path.resolve(options['channel-root']);
  const channel = await validateChannelRoot(root);
  const message = createAcknowledgementMessage({
    reference: await readJson(path.resolve(options.reference)), messageId: options['message-id'],
    sequence: channel.index.next_sequence, channelId: channel.manifest.channel_id,
    senderEnvironment: channel.manifest.publisher.environment_id,
    recipientEnvironment: channel.manifest.recipient.environment_id,
    createdAt: options['created-at'], status: options.status, subject: options.subject,
    summary: options.summary, body: options.body || '', messageType: options['message-type'] || 'acknowledgement'
  });
  const result = await proposeMessage(root, message, path.resolve(options.proposal));
  console.log(JSON.stringify({ status: 'ACKNOWLEDGEMENT_PROPOSED_NOT_PUBLISHED', path: result.message_path, sha256: result.message_sha256 }));
}

main().catch((error) => { console.error(`PAIRWISE ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
