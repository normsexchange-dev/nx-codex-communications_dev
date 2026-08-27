import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { negotiateVersions, parseArgs, readJson, sanitizedError } from './lib/nx-interface.mjs';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.sender || !args.receiver) throw new Error('sender_and_receiver_documents_required');
  const sender = await readJson(path.resolve(args.sender));
  const receiver = await readJson(path.resolve(args.receiver));
  const result = negotiateVersions(sender, receiver);
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'NEGOTIATED') process.exitCode = 2;
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`NEGOTIATION ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
}
