import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SOURCE_REPOSITORY, TAG, VERSION, assert, readJson, sanitizedError } from './lib/nx-interface.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRED = [
  '.github/workflows/validate-communications.yml', 'AUTOSTART.md', 'BOOTSTRAP_STATUS_dev.md', 'CHANGELOG.md', 'COMMUNICATIONS_VERSION', 'README.md',
  'docs/AUTONOMOUS_RUNTIME_REFERENCE_dev.md', 'docs/CREDENTIAL_ACCESS_BOUNDARY_dev.md', 'docs/INTEROPERABILITY_PROTOCOL_dev.md',
  'docs/RECOVERY_PROTOCOL_dev.md', 'docs/SECURITY_BOUNDARY_dev.md', 'docs/SOVEREIGNTY_AND_LINEAGE_dev.md',
  'docs/PAIRWISE_CHANNEL_PROTOCOL_dev.md',
  'prompts/boundary-emergency-stop-revoke.txt', 'prompts/descendant-sovereign-genesis.txt', 'prompts/existing-environment-adoption.txt',
  'prompts/existing-environment-preservation.txt', 'prompts/fresh-sovereign-genesis.txt', 'prompts/receiver-compatibility-check.txt',
  'prompts/standing-autonomous-wtb-mission.txt', 'release/previous-tags.json',
  'prompts/pairwise/01-create-publisher-channel.txt', 'prompts/pairwise/02-grant-read-only-reader.txt',
  'prompts/pairwise/03-create-reciprocal-channel.txt', 'prompts/pairwise/04-verify-reader-connection.txt',
  'prompts/pairwise/05-publish-owner-message.txt', 'prompts/pairwise/06-acknowledge-from-responder.txt',
  'prompts/pairwise/07-activate-standing-contract-mission.txt', 'prompts/pairwise/08-emergency-revoke-reader.txt',
  'schemas/nx-capabilities.schema.json', 'schemas/nx-environment.schema.json', 'schemas/nx-genesis.schema.json',
  'schemas/nx-interoperability.schema.json', 'schemas/nx-lineage.schema.json', 'schemas/nx-provenance.schema.json',
  'schemas/pairwise-channel.schema.json', 'schemas/pairwise-message.schema.json', 'schemas/cross-repository-reference.schema.json',
  'schemas/outbound-index.schema.json', 'schemas/reader-cache.schema.json',
  'scripts/lib/nx-interface.mjs', 'scripts/materialize-genesis.mjs', 'scripts/negotiate-version.mjs',
  'scripts/lib/pairwise-channel.mjs', 'scripts/initialize-pairwise-channel.mjs', 'scripts/validate-pairwise-channel.mjs',
  'scripts/propose-pairwise-message.mjs', 'scripts/create-pairwise-acknowledgement.mjs',
  'scripts/validate-wtb-payload-reference.mjs', 'scripts/verify-reader-permission.mjs', 'scripts/consume-pairwise-channel.mjs',
  'scripts/security-review.mjs', 'scripts/test-communications.mjs', 'scripts/validate-communications.mjs',
  'scripts/verify-interface.mjs', 'scripts/verify-public-interface.mjs', 'tests/sovereign-interface.test.mjs', 'tests/pairwise-channel.test.mjs'
];
const ALLOWED_PUBLIC_REPOSITORIES = new Set([SOURCE_REPOSITORY, 'normsexchange-dev/nx-sourcing-contracts_dev']);
const CREDENTIAL_PATTERNS = [/gh[pousr]_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];

function git(args) {
  return execFileSync(process.env.GIT_EXECUTABLE || 'git', ['-c', `safe.directory=${root.split(path.sep).join('/')}`, '-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

async function walk(directory, relative = '') {
  const { readdir } = await import('node:fs/promises');
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules'].includes(entry.name)) continue;
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), childRelative));
    else if (entry.isFile()) files.push(childRelative);
  }
  return files.sort();
}

function parseBranch(argv) {
  const index = argv.indexOf('--branch');
  assert(index >= 0 && index + 1 < argv.length, 'branch_argument_required');
  const branch = argv[index + 1];
  assert(branch === 'main' || branch === TAG || /^agent\/[A-Za-z0-9_]+\/[a-z0-9.-]+$/.test(branch), 'source_branch_invalid');
  return branch;
}

async function validateSchemas() {
  for (const name of ['nx-capabilities.schema.json', 'nx-environment.schema.json', 'nx-genesis.schema.json', 'nx-interoperability.schema.json', 'nx-lineage.schema.json', 'nx-provenance.schema.json']) {
    const schema = await readJson(path.join(root, 'schemas', name));
    assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', `schema_draft_invalid:${name}`);
    assert(schema.$id === `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/${TAG}/schemas/${name}`, `sovereign_schema_identity_invalid:${name}`);
    assert(schema.type === 'object' && schema.additionalProperties === false, `schema_not_restrictive:${name}`);
  }
  for (const name of ['pairwise-channel.schema.json', 'pairwise-message.schema.json', 'cross-repository-reference.schema.json', 'outbound-index.schema.json', 'reader-cache.schema.json']) {
    const schema = await readJson(path.join(root, 'schemas', name));
    assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', `schema_draft_invalid:${name}`);
    assert(schema.$id === `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/${TAG}/schemas/${name}`, `schema_release_identity_invalid:${name}`);
    assert(schema.type === 'object' && schema.additionalProperties === false, `schema_not_restrictive:${name}`);
  }
}

async function validatePreviousTags() {
  const release = await readJson(path.join(root, 'release', 'previous-tags.json'));
  assert(release.schema_version === '1.0.0' && release.tags.length === 7, 'previous_tag_catalog_invalid');
  for (const entry of release.tags) {
    assert(git(['rev-parse', `refs/tags/${entry.tag}`]) === entry.object, `previous_tag_object_changed:${entry.tag}`);
    assert(git(['cat-file', '-t', `refs/tags/${entry.tag}`]) === entry.type, `previous_tag_type_changed:${entry.tag}`);
    assert(git(['rev-list', '-n', '1', `refs/tags/${entry.tag}`]) === entry.target, `previous_tag_target_changed:${entry.tag}`);
  }
}

async function main() {
  const branch = parseBranch(process.argv.slice(2));
  const files = await walk(root);
  for (const required of REQUIRED) assert(files.includes(required), `required_source_file_missing:${required}`);
  assert((await readFile(path.join(root, 'COMMUNICATIONS_VERSION'), 'utf8')).trim() === VERSION, 'communications_version_mismatch');
  await validateSchemas();
  await validatePreviousTags();

  const workflow = await readFile(path.join(root, '.github/workflows/validate-communications.yml'), 'utf8');
  assert(/permissions:\s*\r?\n\s+contents:\s*read/.test(workflow) && !/contents:\s*write/.test(workflow), 'workflow_permissions_invalid');
  assert(/actions\/checkout@[a-f0-9]{40}/.test(workflow) && /actions\/setup-node@[a-f0-9]{40}/.test(workflow), 'workflow_actions_not_commit_pinned');
  assert(workflow.includes('validate-communications.mjs') && workflow.includes('--test tests/*.test.mjs'), 'workflow_validation_missing');
  assert(!/\bsecrets\./.test(workflow) && !/pull_request_target/.test(workflow), 'workflow_secret_or_untrusted_trigger');

  const readme = (await readFile(path.join(root, 'README.md'), 'utf8')).toLowerCase();
  for (const phrase of ['genesis proves lineage', 'sovereignty begins', 'reserved `.nx/`', 'no global external-environment go/no-go', 'communications-v0.6.0', 'publisher-owned pairwise channels', 'sole writer', 'not admit records']) assert(readme.includes(phrase), `readme_boundary_missing:${phrase}`);
  const recovery = await readFile(path.join(root, 'docs/RECOVERY_PROTOCOL_dev.md'), 'utf8');
  assert(recovery.includes('Historical v0.4 recovery protocol') && recovery.includes('superseded'), 'historical_recovery_not_marked');
  for (const prompt of files.filter((item) => item.startsWith('prompts/') && item.endsWith('.txt'))) {
    const text = await readFile(path.join(root, prompt), 'utf8');
    const privateMarkers = [['nx', 'gemini', 'intake_dev'].join('-'), ['ai', 'agent', 'control'].join('-'), ['ai', 'agent', 'ops'].join('-')];
    assert(!privateMarkers.some((marker) => text.includes(marker)), `public_prompt_private_topology:${prompt}`);
  }
  const materializer = await readFile(path.join(root, 'scripts/materialize-genesis.mjs'), 'utf8');
  const offlineVerifier = await readFile(path.join(root, 'scripts/verify-interface.mjs'), 'utf8');
  assert(!/\bfetch\s*\(/.test(materializer) && !/\bfetch\s*\(/.test(offlineVerifier), 'offline_tools_must_not_use_network');
  assert(!/(?:OpenAI|generateContent|model\.generate)/i.test(materializer + offlineVerifier), 'offline_tools_must_not_call_models');
  const pairwiseOffline = await Promise.all([
    'scripts/lib/pairwise-channel.mjs', 'scripts/initialize-pairwise-channel.mjs', 'scripts/validate-pairwise-channel.mjs',
    'scripts/propose-pairwise-message.mjs', 'scripts/create-pairwise-acknowledgement.mjs', 'scripts/validate-wtb-payload-reference.mjs'
  ].map((relative) => readFile(path.join(root, relative), 'utf8')));
  assert(!pairwiseOffline.some((text) => /node:https|\bfetch\s*\(|OpenAI|generateContent|model\.generate/i.test(text)), 'pairwise_offline_tool_network_or_model');
  for (const relative of ['scripts/verify-reader-permission.mjs', 'scripts/consume-pairwise-channel.mjs']) {
    const text = await readFile(path.join(root, relative), 'utf8');
    assert(/method:\s*'GET'/.test(text), `reader_tool_get_missing:${relative}`);
    assert(!/method:\s*'(?:POST|PUT|PATCH|DELETE)'/.test(text) && !/\/collaborators|\/invitations|git\/refs/.test(text), `reader_tool_mutation_surface:${relative}`);
  }

  for (const relative of files) {
    const buffer = await readFile(path.join(root, relative));
    if (buffer.includes(0)) continue;
    const text = buffer.toString('utf8');
    assert(!CREDENTIAL_PATTERNS.some((pattern) => pattern.test(text)), `credential_signature_found:${relative}`);
    assert(!/[A-Za-z]:[\\/]Users[\\/]/.test(text) && !/(?:^|\s)\/(?:home|Users)\/[A-Za-z0-9._-]+\//m.test(text), `private_local_path_found:${relative}`);
    for (const match of text.matchAll(/normsexchange-dev\/[A-Za-z0-9._-]+/gi)) assert(ALLOWED_PUBLIC_REPOSITORIES.has(match[0]), `unapproved_public_repository:${relative}`);
    if (relative.endsWith('.mjs')) for (const match of text.matchAll(/^import .* from ['"]([^'"]+)['"];$/gm)) assert(match[1].startsWith('node:') || match[1].startsWith('.'), `third_party_import:${relative}`);
  }
  console.log(`validate-communications: PASS (${files.length} files; communications ${VERSION}; branch ${branch}; seven prior tags immutable)`);
}

main().catch((error) => { console.error(`VALIDATION ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
