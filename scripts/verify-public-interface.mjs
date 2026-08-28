import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NX_FILES, parseArgs, sanitizedError, stableStringify } from './lib/nx-interface.mjs';
import { verifyInterface } from './verify-interface.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

async function githubJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'nx-sovereign-interface-verifier/0.6.0' } });
  if (!response.ok) {
    const error = new Error(`github_http_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function unadopted(repository, commit) {
  return {
    schema_version: '1.0.0', repository, commit,
    genesis: 'GENESIS_UNVERIFIED', environment_state: 'UNKNOWN', interface: 'NOT_YET_ADOPTED',
    credential_review: 'UNKNOWN', external_access: 'UNKNOWN', data_admission: 'UNKNOWN',
    service_health: 'NOT_ASSESSED', negotiated_version: null, environment_id: null,
    finding_codes: ['nx_surface_absent']
  };
}

export async function verifyPublicInterface(repository, commit) {
  if (!REPOSITORY_PATTERN.test(repository)) throw new Error('repository_invalid');
  if (!SHA_PATTERN.test(commit)) throw new Error('exact_commit_required');
  await githubJson(`https://api.github.com/repos/${repository}/commits/${commit}`);
  let listing;
  try { listing = await githubJson(`https://api.github.com/repos/${repository}/contents/.nx?ref=${commit}`); }
  catch (error) { if (error.status === 404) return unadopted(repository, commit); throw error; }
  const names = listing.filter((entry) => entry.type === 'file').map((entry) => entry.name).sort();
  if (stableStringify(names) !== stableStringify(NX_FILES)) {
    const result = unadopted(repository, commit);
    result.interface = 'INTERFACE_INCOMPATIBLE';
    result.finding_codes = ['nx_reserved_tree_invalid'];
    return result;
  }
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'nx-interface-'));
  try {
    const nxRoot = path.join(temporary, '.nx');
    await mkdir(nxRoot);
    for (const name of NX_FILES) {
      const item = listing.find((entry) => entry.name === name);
      const blob = await githubJson(item.git_url);
      await writeFile(path.join(nxRoot, name), Buffer.from(blob.content.replace(/\s/g, ''), 'base64'));
    }
    return await verifyInterface(temporary, { expectedRepository: repository, commit });
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.repository || !args.commit) throw new Error('repository_and_exact_commit_required');
  const result = await verifyPublicInterface(args.repository, args.commit);
  console.log(JSON.stringify(result, null, 2));
  if (result.interface === 'INTERFACE_INCOMPATIBLE') process.exitCode = 2;
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`PUBLIC INTERFACE ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
}
