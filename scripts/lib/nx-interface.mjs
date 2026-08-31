import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const VERSION = '0.8.0';
export const TAG = `communications-v${VERSION}`;
export const SOURCE_REPOSITORY = 'normsexchange-dev/nx-codex-communications_dev';
export const SOVEREIGN_INTERFACE_VERSION = '0.5.0';
export const CORE_SCHEMA_TAG = TAG;
export const PAIRWISE_SCHEMA_TAG = 'communications-v0.7.0';
export const SOVEREIGN_SCHEMA_TAG = 'communications-v0.5.0';
export const NX_FILES = [
  'capabilities.json',
  'environment.json',
  'genesis.json',
  'interoperability.json',
  'lineage.json',
  'provenance.json'
];
export const INTERFACES = [
  'nx.capabilities',
  'nx.environment',
  'nx.genesis',
  'nx.interoperability',
  'nx.lineage',
  'nx.provenance'
];
export const PROVENANCE = [
  'synthetic', 'simulated', 'inferred', 'public_observation', 'externally_reported',
  'buyer_confirmed', 'norms_verified'
];
export const CAPABILITY_STATES = [
  'internal_available', 'declared', 'technically_granted', 'ray_standing_authorized',
  'ray_temporarily_authorized', 'observed', 'requested', 'revoked'
];

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const ENVIRONMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{1,127}$/;

export function assert(condition, code) {
  if (!condition) throw new Error(code);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function prettyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function hashJson(value) {
  return sha256(stableStringify(value));
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export function exactKeys(value, keys, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label}_object_required`);
  assert(stableStringify(Object.keys(value).sort()) === stableStringify([...keys].sort()), `${label}_fields_invalid`);
}

export function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) { result._.push(item); continue; }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) result[key] = true;
    else { result[key] = next; index += 1; }
  }
  return result;
}

export function validateIdentity({ owner, repository, environmentId }) {
  assert(typeof owner === 'string' && /^[A-Za-z0-9_.-]+$/.test(owner), 'identity_owner_invalid');
  assert(REPOSITORY_PATTERN.test(repository), 'identity_repository_invalid');
  assert(repository.split('/')[0] === owner, 'identity_owner_repository_collision');
  assert(ENVIRONMENT_PATTERN.test(environmentId), 'identity_environment_invalid');
  return true;
}

export function releaseIdentityFromGit(sourceRoot, gitExecutable = process.env.GIT_EXECUTABLE || 'git') {
  const safeRoot = path.resolve(sourceRoot).split(path.sep).join('/');
  const run = (args) => execFileSync(gitExecutable, ['-c', `safe.directory=${safeRoot}`, '-C', sourceRoot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const tagObject = run(['rev-parse', `refs/tags/${TAG}`]);
  assert(run(['cat-file', '-t', `refs/tags/${TAG}`]) === 'tag', 'source_tag_must_be_annotated');
  const targetCommit = run(['rev-list', '-n', '1', `refs/tags/${TAG}`]);
  assert(SHA_PATTERN.test(tagObject) && SHA_PATTERN.test(targetCommit), 'source_release_git_identity_invalid');
  assert(run(['rev-parse', 'HEAD']) === targetCommit, 'source_checkout_not_release_target');
  const sourceDigest = sha256(run(['ls-tree', '-r', '--full-tree', targetCommit]));
  return { repository: SOURCE_REPOSITORY, tag: TAG, tag_object: tagObject, target_commit: targetCommit, source_digest: sourceDigest };
}

export function coreDigestPayload(environment, lineage, capabilities, provenance, interoperability) {
  return {
    environment,
    lineage,
    capabilities,
    provenance,
    interoperability: {
      schema_version: interoperability.schema_version,
      protocol_id: interoperability.protocol_id,
      current: interoperability.current,
      supported: interoperability.supported,
      preferred: interoperability.preferred,
      deprecated: interoperability.deprecated,
      unsupported: interoperability.unsupported,
      receiver_selection: interoperability.receiver_selection,
      interfaces: interoperability.interfaces
    }
  };
}

export function createSurface(options) {
  validateIdentity(options);
  assert(options.release?.repository === SOURCE_REPOSITORY && options.release?.tag === TAG, 'genesis_release_invalid');
  for (const field of ['tag_object', 'target_commit']) assert(SHA_PATTERN.test(options.release[field]), `genesis_release_${field}_invalid`);
  assert(SHA256_PATTERN.test(options.release.source_digest), 'genesis_release_source_digest_invalid');
  assert(SHA_PATTERN.test(options.genesisCommit), 'genesis_commit_invalid');
  assert(Number.isFinite(Date.parse(options.materializedAt)), 'genesis_time_invalid');
  assert(typeof options.runtime === 'string' && options.runtime.trim(), 'genesis_runtime_invalid');
  assert(typeof options.humanPrincipal === 'string' && options.humanPrincipal.trim(), 'genesis_human_principal_invalid');
  const mode = options.mode;
  assert(['fresh', 'adopt', 'descendant'].includes(mode), 'genesis_mode_invalid');

  if (mode === 'descendant') {
    validateIdentity({ owner: options.parentOwner, repository: options.parentRepository, environmentId: options.parentEnvironmentId });
    assert(SHA_PATTERN.test(options.parentCommit), 'lineage_parent_commit_invalid');
    assert(options.parentRepository !== options.repository, 'lineage_child_repository_collision');
    assert(options.parentEnvironmentId !== options.environmentId, 'lineage_child_environment_collision');
  }

  const environment = {
    $schema: schemaUrl('nx-environment.schema.json'),
    schema_version: '1.0.0', environment_id: options.environmentId, namespace_owner: options.owner,
    repository: options.repository, environment_type: 'sovereign', runtime: options.runtime,
    human_principal: options.humanPrincipal, created_at: options.materializedAt
  };
  const lineage = {
    $schema: schemaUrl('nx-lineage.schema.json'),
    schema_version: '1.0.0', lineage_type: mode === 'descendant' ? 'descendant' : 'direct',
    current: { environment_id: options.environmentId, repository: options.repository },
    canonical_genesis: { repository: SOURCE_REPOSITORY, tag: TAG, target_commit: options.release.target_commit },
    parent: mode === 'descendant' ? { environment_id: options.parentEnvironmentId, repository: options.parentRepository, commit: options.parentCommit } : null,
    divergence: { allowed: true, declared: false, description: null },
    amendments: mode === 'adopt' ? [{ type: 'historical_genesis_adoption', reference: options.historicalGenesis || 'externally_reported_prior_genesis' }] : [],
    descendants: []
  };
  const capabilities = {
    $schema: schemaUrl('nx-capabilities.schema.json'),
    schema_version: '1.0.0', environment_id: options.environmentId, declarations: []
  };
  const provenance = {
    $schema: schemaUrl('nx-provenance.schema.json'),
    schema_version: '1.0.0', environment_id: options.environmentId, records: []
  };
  const interoperability = {
    $schema: schemaUrl('nx-interoperability.schema.json'),
    schema_version: '1.0.0', protocol_id: 'nx-sovereign-interoperability', current: SOVEREIGN_INTERFACE_VERSION,
    supported: [SOVEREIGN_INTERFACE_VERSION], preferred: SOVEREIGN_INTERFACE_VERSION, deprecated: ['0.4.0'], unsupported: ['0.1.0', '0.1.1', '0.1.2', '0.2.0', '0.3.0'],
    receiver_selection: 'highest_common_preferred_then_highest_common_supported', interfaces: INTERFACES,
    hashes: {}
  };
  const initialCoreDigest = hashJson(coreDigestPayload(environment, lineage, capabilities, provenance, interoperability));
  const genesis = {
    $schema: schemaUrl('nx-genesis.schema.json'),
    schema_version: '1.0.0', genesis_type: mode === 'adopt' ? 'historical_adoption' : mode,
    canonical_release: options.release,
    materializer: { name: 'nx-sovereign-genesis', version: VERSION },
    destination: { owner: options.owner, repository: options.repository, environment_id: options.environmentId, runtime: options.runtime },
    materialized_at: options.materializedAt, genesis_commit: options.genesisCommit,
    initial_core_digest: initialCoreDigest, human_principal: options.humanPrincipal,
    sovereignty_transfer: { state: 'transferred', recipient: options.repository, effective_at: options.materializedAt }
  };
  const documents = { 'environment.json': environment, 'genesis.json': genesis, 'lineage.json': lineage, 'capabilities.json': capabilities, 'provenance.json': provenance };
  interoperability.hashes = Object.fromEntries(Object.entries(documents).sort(([left], [right]) => left.localeCompare(right)).map(([name, value]) => [name, hashJson(value)]));
  documents['interoperability.json'] = interoperability;
  return documents;
}

export function schemaUrl(name, tag = CORE_SCHEMA_TAG) {
  return `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/${tag}/schemas/${name}`;
}

export async function writeSurface(root, documents) {
  const nxRoot = path.join(root, '.nx');
  await mkdir(nxRoot, { recursive: true });
  for (const name of NX_FILES) await writeFile(path.join(nxRoot, name), prettyJson(documents[name]), { encoding: 'utf8', flag: 'wx' });
}

export async function directoryEntries(root) {
  try { return await readdir(root); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

export async function isDirectory(filePath) {
  try { return (await stat(filePath)).isDirectory(); } catch { return false; }
}

export function negotiateVersions(sender, receiver) {
  const common = sender.supported.filter((item) => receiver.supported.includes(item));
  const active = common.filter((item) => !sender.unsupported.includes(item) && !receiver.unsupported.includes(item));
  const preferred = [receiver.preferred, sender.preferred].find((item) => active.includes(item));
  const selected = preferred || active.sort(compareSemver).at(-1) || null;
  return { status: selected ? 'NEGOTIATED' : 'NO_COMMON_VERSION', selected, common: active.sort(compareSemver) };
}

function compareSemver(left, right) {
  const a = left.split('.').map(Number); const b = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}

export function sanitizedError(error) {
  return String(error?.message || 'unknown_error').replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 200);
}
