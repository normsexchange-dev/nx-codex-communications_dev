import { execFileSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  NX_FILES, createSurface, directoryEntries, parseArgs, readJson, releaseIdentityFromGit,
  sanitizedError, stableStringify, writeSurface
} from './lib/nx-interface.mjs';
import { verifyInterface } from './verify-interface.mjs';

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

function repositoryFromGit(root, gitExecutable = process.env.GIT_EXECUTABLE || 'git') {
  try {
    const remote = execFileSync(gitExecutable, ['-C', root, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().replace(/\.git$/, '');
    const match = remote.match(/github\.com[/:]([^/]+\/[^/]+)$/i);
    return match?.[1] || null;
  } catch { return null; }
}

async function assertOutputEmpty(root) {
  const entries = (await directoryEntries(root)).filter((entry) => entry !== '.git');
  if (entries.length) throw new Error('genesis_output_not_empty');
}

async function documentsEqual(root, documents) {
  try {
    for (const name of NX_FILES) if (stableStringify(await readJson(path.join(root, '.nx', name))) !== stableStringify(documents[name])) return false;
    return true;
  } catch { return false; }
}

export async function materialize(options) {
  const documents = createSurface(options);
  if (options.mode === 'adopt') {
    const destinationRoot = path.resolve(options.destinationRoot);
    const proposalRoot = path.resolve(options.proposalRoot);
    const observedRepository = repositoryFromGit(destinationRoot, options.gitExecutable);
    if (observedRepository && observedRepository !== options.repository) throw new Error('adoption_repository_identity_mismatch');
    if (await exists(path.join(destinationRoot, '.nx'))) throw new Error('adoption_surface_already_present');
    await assertOutputEmpty(proposalRoot);
    await writeSurface(proposalRoot, documents);
    return { status: 'PROPOSED', mode: 'adopt', proposal_root: proposalRoot, destination_mutated: false, files: NX_FILES.map((name) => `.nx/${name}`) };
  }

  const outputRoot = path.resolve(options.outputRoot);
  if (await exists(path.join(outputRoot, '.nx'))) {
    const result = await verifyInterface(outputRoot, { expectedRepository: options.repository });
    if (result.interface === 'INTERFACE_COMPATIBLE' && await documentsEqual(outputRoot, documents)) return { status: 'IDEMPOTENT', mode: options.mode, files: NX_FILES.length };
    throw new Error('existing_genesis_surface_conflict');
  }
  await assertOutputEmpty(outputRoot);
  await writeSurface(outputRoot, documents);
  return { status: 'MATERIALIZED', mode: options.mode, files: NX_FILES.length, sovereignty: 'transferred' };
}

function required(options, names) {
  for (const name of names) if (!options[name]) throw new Error(`argument_required:${name}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  required(args, ['mode', 'owner', 'repository', 'environment', 'runtime', 'human-principal', 'genesis-commit', 'materialized-at']);
  if (!['fresh', 'adopt', 'descendant'].includes(args.mode)) throw new Error('mode_invalid');
  if (args.mode === 'adopt') required(args, ['destination-root', 'proposal']);
  else required(args, ['output']);
  if (args.mode === 'descendant') required(args, ['parent-owner', 'parent-repository', 'parent-environment', 'parent-commit']);
  const release = releaseIdentityFromGit(scriptRoot, args.git || process.env.GIT_EXECUTABLE || 'git');
  const result = await materialize({
    mode: args.mode, owner: args.owner, repository: args.repository, environmentId: args.environment,
    runtime: args.runtime, humanPrincipal: args['human-principal'], genesisCommit: args['genesis-commit'],
    materializedAt: args['materialized-at'], release, outputRoot: args.output,
    destinationRoot: args['destination-root'], proposalRoot: args.proposal,
    historicalGenesis: args['historical-genesis'] || null,
    parentOwner: args['parent-owner'], parentRepository: args['parent-repository'],
    parentEnvironmentId: args['parent-environment'], parentCommit: args['parent-commit'],
    gitExecutable: args.git || process.env.GIT_EXECUTABLE || 'git'
  });
  console.log(JSON.stringify(result, null, 2));
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`MATERIALIZER ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
}
