import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export const VERSION = '0.4.0';
export const VALIDATOR_VERSION = '0.4.0';
export const TAG = `communications-v${VERSION}`;
export const SOURCE_REPOSITORY = 'normsexchange-dev/nx-codex-communications_dev';
export const MISSION_ACKNOWLEDGMENT_ID = 'msg-mission-acknowledgment-v1';
export const MISSION_ACKNOWLEDGMENT_PATH = `outbox/messages/${MISSION_ACKNOWLEDGMENT_ID}.json`;
export const MISSION_ACKNOWLEDGMENT_SUMMARY = 'Acknowledged permanent mission norms-exchange-marketplace version 1.0.0 unchanged.';
export const ADAPTABLE_MANIFEST_FIELDS = [
  'protocol_role',
  'environment_id',
  'github_owner',
  'communications_repository',
  'environment_type',
  'status',
  'updated_at'
];
export const GENERATED_PATHS = [
  'agent-manifest.json',
  'destination-core.json',
  'outbox/index.json',
  MISSION_ACKNOWLEDGMENT_PATH
].sort();
export const STATIC_PATHS = [
  '.gitattributes',
  '.github/workflows/validate-communications.yml',
  '.gitignore',
  'AUTOSTART.md',
  'COMMUNICATIONS_VERSION',
  'README.md',
  'bootstrap/AGENT_BOOTSTRAP_dev.md',
  'docs/MESSAGE_PROTOCOL_dev.md',
  'docs/RECOVERY_PROTOCOL_dev.md',
  'docs/ROLE_BRANCH_PROTOCOL_dev.md',
  'docs/SECURITY_BOUNDARY_dev.md',
  'mission/NORMS_EXCHANGE_MISSION.md',
  'mission/norms-exchange-mission.json',
  'roles/index.json',
  'schemas/agent-manifest.schema.json',
  'schemas/attestation.schema.json',
  'schemas/destination-core.schema.json',
  'schemas/message-envelope.schema.json',
  'schemas/mission.schema.json',
  'schemas/role-manifest.schema.json',
  'scripts/lib/destination-core.mjs',
  'scripts/validate-destination.mjs'
].sort();
export const ALLOWED_DESTINATION_PATHS = [...STATIC_PATHS, ...GENERATED_PATHS].sort();

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9-]+\/nx-[a-z0-9-]+-communications_dev$/;
const MANIFEST_FIELDS = [
  '$schema', 'communications_version', 'protocol_role', 'protocol_source', 'environment_id', 'github_owner',
  'communications_repository', 'environment_type', 'access_model', 'role_branch_grammar', 'supported_protocols',
  'public_capabilities', 'public_safety_boundaries', 'mission', 'bootstrap_document', 'status', 'updated_at'
];

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function canonicalStaticBytes(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  const text = buffer.toString('utf8');
  assert(Buffer.from(text, 'utf8').equals(buffer), 'source_static_file_must_be_utf8');
  return Buffer.from(text.replace(/\r\n/g, '\n'), 'utf8');
}

export async function readCanonicalStatic(root, relativePath) {
  return canonicalStaticBytes(await readFile(path.join(root, relativePath)));
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function exactKeys(value, keys, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label}: object required`);
  assert(stableStringify(Object.keys(value).sort()) === stableStringify([...keys].sort()), `${label}: unexpected fields`);
}

export async function findFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findFiles(absolute));
    if (entry.isFile()) files.push(absolute);
  }
  return files;
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export function expectedDestinationRepository(environmentId) {
  assert(SLUG_PATTERN.test(environmentId), 'destination_environment_invalid');
  const suffix = environmentId.startsWith('normsexchange-') ? environmentId.slice('normsexchange-'.length) : environmentId;
  assert(SLUG_PATTERN.test(suffix), 'destination_environment_suffix_invalid');
  return `${environmentId}/nx-${suffix}-communications_dev`;
}

export function immutableManifest(manifest) {
  return Object.fromEntries(Object.entries(manifest).filter(([key]) => !ADAPTABLE_MANIFEST_FIELDS.includes(key)));
}

function digestPayload(core) {
  return {
    schema_version: core.schema_version,
    validator_version: core.validator_version,
    source: core.source,
    destination: {
      allowed_paths: core.destination.allowed_paths,
      static_files: core.destination.static_files,
      generated_paths: core.destination.generated_paths,
      adaptable_manifest_fields: core.destination.adaptable_manifest_fields,
      immutable_manifest: core.destination.immutable_manifest
    }
  };
}

export function computeCoreDigest(core) {
  return sha256(stableStringify(digestPayload(core)));
}

export function validateCoreDocument(core) {
  exactKeys(core, ['schema_version', 'validator_version', 'source', 'destination'], 'destination-core.json');
  assert(core.schema_version === '1.0.0' && core.validator_version === VALIDATOR_VERSION, 'destination_core_version_mismatch');
  exactKeys(core.source, ['repository', 'release', 'tag_ref', 'tag_object_sha', 'tag_target_sha', 'tag_object_type', 'tag_target_type'], 'destination-core.json.source');
  assert(core.source.repository === SOURCE_REPOSITORY && core.source.release === TAG && core.source.tag_ref === `refs/tags/${TAG}`, 'destination_core_source_identity_mismatch');
  assert(core.source.tag_object_type === 'tag' && core.source.tag_target_type === 'commit', 'destination_core_tag_types_invalid');
  assert(SHA_PATTERN.test(core.source.tag_object_sha) && SHA_PATTERN.test(core.source.tag_target_sha), 'destination_core_git_identity_invalid');
  exactKeys(core.destination, ['allowed_paths', 'static_files', 'generated_paths', 'adaptable_manifest_fields', 'immutable_manifest', 'core_digest'], 'destination-core.json.destination');
  assert(stableStringify(core.destination.allowed_paths) === stableStringify(ALLOWED_DESTINATION_PATHS), 'destination_core_allowed_paths_mismatch');
  assert(stableStringify(core.destination.generated_paths) === stableStringify(GENERATED_PATHS), 'destination_core_generated_paths_mismatch');
  assert(stableStringify(core.destination.adaptable_manifest_fields) === stableStringify(ADAPTABLE_MANIFEST_FIELDS), 'destination_core_adaptable_fields_mismatch');
  assert(Array.isArray(core.destination.static_files) && core.destination.static_files.length === STATIC_PATHS.length, 'destination_core_static_file_count_mismatch');
  const staticPaths = core.destination.static_files.map((entry) => entry.path);
  assert(stableStringify(staticPaths) === stableStringify(STATIC_PATHS), 'destination_core_static_paths_mismatch');
  for (const entry of core.destination.static_files) {
    exactKeys(entry, ['path', 'sha256'], `destination-core static file ${entry.path}`);
    assert(SHA256_PATTERN.test(entry.sha256), `destination_core_static_hash_invalid:${entry.path}`);
  }
  assert(core.destination.core_digest === computeCoreDigest(core), 'destination_core_digest_mismatch');
  return core;
}

function validateDestinationManifest(manifest, core, options) {
  exactKeys(manifest, MANIFEST_FIELDS, 'agent-manifest.json');
  assert(manifest.$schema === './schemas/agent-manifest.schema.json' && manifest.communications_version === VERSION, 'destination_manifest_version_mismatch');
  assert(stableStringify(immutableManifest(manifest)) === stableStringify(core.destination.immutable_manifest), 'destination_manifest_unauthorized_adaptation');
  assert(manifest.protocol_role === 'destination', 'destination_manifest_protocol_role_invalid');
  assert(SLUG_PATTERN.test(manifest.environment_id) && manifest.environment_id === manifest.github_owner, 'destination_manifest_owner_identity_mismatch');
  assert(REPOSITORY_PATTERN.test(manifest.communications_repository), 'destination_manifest_repository_invalid');
  assert(manifest.communications_repository === expectedDestinationRepository(manifest.environment_id), 'destination_manifest_repository_identity_mismatch');
  assert(['initializing', 'ready'].includes(manifest.status), 'destination_manifest_bootstrap_status_invalid');
  assert(typeof manifest.environment_type === 'string' && manifest.environment_type.trim().length >= 1 && manifest.environment_type.length <= 64, 'destination_manifest_runtime_invalid');
  assert(typeof manifest.updated_at === 'string' && Number.isFinite(Date.parse(manifest.updated_at)), 'destination_manifest_updated_at_invalid');
  if (options.expectedRepository) assert(manifest.communications_repository === options.expectedRepository, 'destination_repository_binding_mismatch');
  if (options.expectedEnvironment) assert(manifest.environment_id === options.expectedEnvironment, 'destination_environment_binding_mismatch');
  if (options.expectedOwner) assert(manifest.github_owner === options.expectedOwner, 'destination_owner_binding_mismatch');
  if (options.expectedRuntime) assert(manifest.environment_type === options.expectedRuntime, 'destination_runtime_binding_mismatch');
}

function validateMissionAcknowledgment(message, index, manifest) {
  exactKeys(message, [
    'protocol_version', 'message_id', 'sender_environment', 'recipient_environment', 'message_type', 'role_id',
    'role_branch', 'created_at', 'in_reply_to', 'supported_contract_version', 'public_summary',
    'payload_classification', 'payload_reference', 'payload_sha256', 'supersedes_message_id', 'status'
  ], MISSION_ACKNOWLEDGMENT_PATH);
  assert(message.protocol_version === VERSION && message.message_id === MISSION_ACKNOWLEDGMENT_ID, 'mission_acknowledgment_identity_mismatch');
  assert(message.sender_environment === manifest.environment_id && message.recipient_environment === 'normsexchange-codex', 'mission_acknowledgment_environment_mismatch');
  assert(message.message_type === 'acknowledgment' && message.role_id === null && message.role_branch === null, 'mission_acknowledgment_type_mismatch');
  assert(Number.isFinite(Date.parse(message.created_at)), 'mission_acknowledgment_timestamp_invalid');
  assert(message.in_reply_to === null && message.supported_contract_version === null && message.public_summary === MISSION_ACKNOWLEDGMENT_SUMMARY, 'mission_acknowledgment_content_mismatch');
  assert(message.payload_classification === 'public_sanitized' && message.payload_reference === null && message.payload_sha256 === null, 'mission_acknowledgment_payload_invalid');
  assert(message.supersedes_message_id === null && message.status === 'published', 'mission_acknowledgment_status_invalid');
  exactKeys(index, ['communications_version', 'messages'], 'outbox/index.json');
  assert(index.communications_version === VERSION && Array.isArray(index.messages) && index.messages.length === 1, 'mission_acknowledgment_index_invalid');
  exactKeys(index.messages[0], ['message_id', 'path', 'created_at', 'status'], 'outbox/index.json.messages[0]');
  assert(index.messages[0].message_id === message.message_id && index.messages[0].path === MISSION_ACKNOWLEDGMENT_PATH && index.messages[0].created_at === message.created_at && index.messages[0].status === message.status, 'mission_acknowledgment_index_mismatch');
}

function contaminantFinding(relativePath, text) {
  const lower = relativePath.toLowerCase();
  if (/(^|\/)(package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|server\.(?:ts|js)|agents\.md|evolution\.md)$/.test(lower)) return 'prohibited_application_or_agent_path';
  if (/(^|\/)(src|server|data|build|dist)(\/|$)|(^|\/)\.env($|\.)|\.(?:db|sqlite|sqlite3|sql)$/.test(lower)) return 'prohibited_application_data_or_environment_path';
  if (/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{35,})/.test(text)) return 'possible_credential_value';
  if (/(?:localStorage|sessionStorage)[\s\S]{0,160}(?:token|pat|github)|(?:token|pat|github)[\s\S]{0,160}(?:localStorage|sessionStorage)/i.test(text)) return 'browser_token_storage';
  if (/(?:GITHUB_TOKEN|CODEX_INTAKE_TOKEN|api\.github\.com|octokit|git\s+push|createOrUpdateFileContents)/i.test(text)) return 'github_write_or_sync_logic';
  if (/(?:self[- _]?(?:replicat|author)|expand[\s\S]{0,80}(?:authority|role)|autonom(?:ous|ously)[\s\S]{0,80}(?:outreach|publish|commerce|push|deploy))/i.test(text)) return 'self_authority_or_replication';
  if (/(?:"candidate"|"listing")[\s\S]{0,200}(?:"verified"|"price"|"contact")/i.test(text)) return 'marketplace_record_artifact';
  return null;
}

export async function validateDestination(root, options = {}) {
  const files = await findFiles(root);
  const relativeFiles = files.map((file) => path.relative(root, file).split(path.sep).join('/')).sort();
  const pathFindings = [];
  for (const relativePath of relativeFiles) {
    // Allowed static files are hash-pinned, and generated JSON is validated field-by-field below.
    // Contaminant scanning therefore applies to unexpected additions, without matching the
    // protocol's own literal safety boundary names.
    if (ALLOWED_DESTINATION_PATHS.includes(relativePath)) continue;
    const text = await readFile(path.join(root, relativePath), 'utf8').catch(() => '');
    const finding = contaminantFinding(relativePath, text);
    if (finding) pathFindings.push({ path: relativePath, finding });
  }
  assert(pathFindings.length === 0, `destination_contaminant:${pathFindings[0]?.finding}:${pathFindings[0]?.path}`);
  assert(stableStringify(relativeFiles) === stableStringify(ALLOWED_DESTINATION_PATHS), 'destination_tree_not_exact');

  const core = validateCoreDocument(await readJson(path.join(root, 'destination-core.json')));
  for (const entry of core.destination.static_files) {
    const actual = sha256(await readFile(path.join(root, entry.path)));
    assert(actual === entry.sha256, `destination_static_hash_mismatch:${entry.path}`);
  }
  const manifest = await readJson(path.join(root, 'agent-manifest.json'));
  validateDestinationManifest(manifest, core, options);
  const roles = await readJson(path.join(root, 'roles/index.json'));
  assert(stableStringify(roles) === stableStringify({ communications_version: VERSION, roles: [] }), 'destination_role_created_during_bootstrap');
  const message = await readJson(path.join(root, MISSION_ACKNOWLEDGMENT_PATH));
  const index = await readJson(path.join(root, 'outbox/index.json'));
  validateMissionAcknowledgment(message, index, manifest);
  return {
    result: 'GO',
    repository: manifest.communications_repository,
    status: manifest.status,
    core_digest: core.destination.core_digest,
    source_tag_object: core.source.tag_object_sha,
    source_tag_target: core.source.tag_target_sha,
    mission_acknowledgment_id: message.message_id,
    validator_version: VALIDATOR_VERSION,
    file_count: relativeFiles.length
  };
}

export function sanitizedErrorCode(error) {
  const message = String(error?.message || 'validation_failed');
  return message.replace(/[^A-Za-z0-9_:\/.-]/g, '_').slice(0, 240);
}
