import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '0.3.0';
const TAG = `communications-v${VERSION}`;
const DRAFT = 'https://json-schema.org/draft/2020-12/schema';
const SOURCE_REPOSITORY = 'normsexchange-dev/nx-codex-communications_dev';
const TAGGED_SCHEMA_ROOT = `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/${TAG}/schemas`;
const AUTOSTART_URL = `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/${TAG}/AUTOSTART.md`;
const CANONICAL_AUTOSTART_PROMPT = `Initialize NX environment normsexchange-gemini from ${AUTOSTART_URL}`;
const ROLE_BRANCH_GRAMMAR = '^role/[a-z0-9]+(?:-[a-z0-9]+)*/[a-z0-9]+(?:-[a-z0-9]+)*$';
const ROLE_BRANCH_PATTERN = new RegExp(ROLE_BRANCH_GRAMMAR);
const ROLE_BRANCH_CAPTURE = /^role\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9-]+\/nx-[a-z0-9-]+-communications_dev$/;
const MESSAGE_ID_PATTERN = /^msg-[a-z0-9][a-z0-9-]{15,79}$/;
const MESSAGE_PATH_PATTERN = /^outbox\/messages\/(msg-[a-z0-9][a-z0-9-]{15,79})\.json$/;
const SEMVER_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const TAG_PATTERN = /^[a-z][a-z0-9-]*-v[0-9]+\.[0-9]+\.[0-9]+$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const PUBLIC_IDENTIFIER_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const ENVIRONMENT_TYPE_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._ -]{0,62}[A-Za-z0-9])?$/;
const GITHUB_REPOSITORY_URL_PATTERN = /https:\/\/(github\.com|raw\.githubusercontent\.com)\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)/g;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_CORE_FILES = [
  '.github/workflows/validate-communications.yml', '.gitignore', 'AUTOSTART.md', 'COMMUNICATIONS_VERSION', 'README.md',
  'agent-manifest.json', 'bootstrap/AGENT_BOOTSTRAP_dev.md', 'docs/MESSAGE_PROTOCOL_dev.md',
  'docs/ROLE_BRANCH_PROTOCOL_dev.md', 'docs/SECURITY_BOUNDARY_dev.md', 'mission/NORMS_EXCHANGE_MISSION.md',
  'mission/norms-exchange-mission.json', 'outbox/index.json', 'roles/index.json',
  'schemas/agent-manifest.schema.json', 'schemas/message-envelope.schema.json', 'schemas/mission.schema.json',
  'schemas/role-manifest.schema.json', 'scripts/validate-communications.mjs', 'tests/destination-bootstrap-regressions.json'
].sort();
const CORE_FILE_SET = new Set(REQUIRED_CORE_FILES);
const AGENT_FIELDS = [
  '$schema', 'communications_version', 'protocol_role', 'protocol_source', 'environment_id', 'github_owner',
  'communications_repository', 'environment_type', 'access_model', 'role_branch_grammar', 'supported_protocols',
  'public_capabilities', 'public_safety_boundaries', 'mission', 'bootstrap_document', 'status', 'updated_at'
];
const ROLE_FIELDS = [
  'role_id', 'role_name', 'purpose', 'goal', 'originating_environment', 'bootstrap_version',
  'communications_version', 'allowed_inputs', 'expected_outputs', 'data_classification',
  'allowed_actions', 'prohibited_actions', 'supported_protocol_versions', 'created_at', 'status'
];
const MESSAGE_FIELDS = [
  'protocol_version', 'message_id', 'sender_environment', 'recipient_environment', 'message_type',
  'role_id', 'role_branch', 'created_at', 'in_reply_to', 'supported_contract_version', 'public_summary',
  'payload_classification', 'payload_reference', 'payload_sha256', 'supersedes_message_id', 'status'
];
const MISSION_FIELDS = [
  '$schema', 'mission_id', 'mission_version', 'immutability', 'business_purpose', 'marketplace_modes',
  'market_corridor', 'equipment_scope', 'norms_services', 'evidence_rules', 'prohibited_actions', 'authority_rule'
];
const ALLOWED_INPUTS = new Set(['immutable_public_protocol', 'public_web_information', 'sanitized_public_message', 'public_repository_content']);
const EXPECTED_OUTPUTS = new Set(['sanitized_public_research', 'sanitized_status', 'sanitized_acknowledgment', 'public_protocol_artifact']);
const ALLOWED_ACTIONS = new Set(['read_immutable_public_protocols', 'research_public_information', 'publish_sanitized_status', 'publish_sanitized_acknowledgment']);
const PROHIBITED_ACTIONS = [
  'outreach', 'third_party_messages', 'purchase_or_sale', 'shopify_mutation',
  'customer_seller_listing_inventory_or_order_creation', 'private_information_publication',
  'credential_access', 'unrelated_repository_access', 'access_control_bypass',
  'destructive_github_operations', 'self_authority_expansion'
];
const MESSAGE_TYPES = new Set(['assignment', 'acknowledgment', 'response', 'status', 'correction', 'protocol_notice']);
const MESSAGE_STATUSES = new Set(['published', 'acknowledged', 'superseded']);
const ROLE_STATUSES = new Set(['proposed', 'active', 'paused', 'completed', 'cancelled']);
const EXPECTED_CAPABILITIES = [
  'public_protocol_publication', 'sanitized_message_publication', 'bounded_role_declaration',
  'public_information_research_coordination'
];
const EXPECTED_BOUNDARIES = [
  'public_information_only', 'no_cross_account_writes', 'no_self_authority_expansion',
  'no_private_data_publication', 'no_credentials_or_private_paths'
];
const MISSION_EQUIPMENT = [
  'cameras and camera systems', 'lenses and optical accessories', 'lighting and grip equipment',
  'audio and sound equipment', 'monitoring video and wireless systems',
  'power media storage and support equipment', 'production post-production and specialty film equipment'
];
const MISSION_SERVICES = [
  'evidence review and marketplace classification',
  'seller and buyer confirmation through separately authorized workflows',
  'cross-border coordination and logistics support', 'inspection documentation and transaction support',
  'governed publication of approved WTS and WTB listings'
];
const MISSION_EVIDENCE = [
  'Use only lawfully accessible public information unless Ray separately authorizes another source.',
  'Keep sourced facts separate from inference and preserve source URLs languages and observation timestamps.',
  'Never fabricate organizations people contacts equipment quantities budgets currencies timelines prices or demand.',
  'A candidate or lead is not a confirmed buyer seller customer inventory item or published listing.'
];
const MISSION_PROHIBITIONS = [
  'fabrication', 'outreach_without_explicit_authorization', 'shopify_mutation',
  'public_listing_without_norms_approval', 'purchase_or_sale', 'customer_or_seller_creation',
  'private_information_publication'
];
const REGRESSION_MUTATIONS = [
  'short_message_id', 'unsupported_initialization_ack', 'wrong_or_missing_envelope_fields',
  'invalid_outbox_index', 'nonconforming_role_manifest', 'empty_role_index',
  'source_bound_validator', 'missing_or_unrun_workflow', 'ready_before_validation',
  'lightweight_release_tag'
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys, label) {
  assert(isObject(value), `${label}: object required`);
  assert(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${label}: unexpected fields`);
}

function validDateTime(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function bounded(value, label, max = 1000) {
  assert(typeof value === 'string' && value.trim().length >= 1 && value.length <= max, `${label}: bounded nonempty string required`);
}

function enumArray(value, allowed, label) {
  assert(Array.isArray(value) && value.length >= 1 && new Set(value).size === value.length, `${label}: unique nonempty array required`);
  for (const item of value) assert(typeof item === 'string' && allowed.has(item), `${label}: invalid value: ${item}`);
}

function exactArray(value, expected, label) {
  assert(JSON.stringify(value) === JSON.stringify(expected), `${label}: exact values or order changed`);
}

function nullablePattern(value, pattern, label) {
  assert(value === null || (typeof value === 'string' && pattern.test(value)), `${label}: invalid value`);
}

function parseBranchName(branchName) {
  assert(typeof branchName === 'string' && branchName.length >= 1 && branchName.length <= 255 && !/\s/.test(branchName), 'branch name must be explicit and safe');
  if (branchName === 'main') return { kind: 'main', name: branchName };
  const match = branchName.match(ROLE_BRANCH_CAPTURE);
  if (match) return { kind: 'role', name: branchName, roleSlug: match[1], goalSlug: match[2] };
  assert(!branchName.startsWith('role/'), `malformed role branch: ${branchName}`);
  return { kind: 'maintenance', name: branchName };
}

function parseBranchArgument(argv = process.argv.slice(2), environment = process.env) {
  let branch = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--branch') {
      assert(index + 1 < argv.length && branch === null, '--branch requires one value');
      branch = argv[++index];
    } else if (argument.startsWith('--branch=')) {
      assert(branch === null, 'branch specified more than once');
      branch = argument.slice(9);
    } else throw new Error(`unknown argument: ${argument}`);
  }
  branch ||= environment.NX_COMMUNICATIONS_BRANCH || null;
  assert(branch, 'branch is required through --branch or NX_COMMUNICATIONS_BRANCH');
  return branch;
}

async function findFiles(directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findFiles(absolute));
    if (entry.isFile()) files.push(absolute);
  }
  return files;
}

async function readJson(relativePath) {
  try { return JSON.parse(await readFile(path.join(root, relativePath), 'utf8')); }
  catch (error) { throw new Error(`${relativePath}: invalid JSON: ${error.message}`); }
}

function expectedDestinationRepository(environmentId) {
  assert(SLUG_PATTERN.test(environmentId), 'destination environment ID must be a lowercase slug');
  const suffix = environmentId.startsWith('normsexchange-') ? environmentId.slice('normsexchange-'.length) : environmentId;
  assert(SLUG_PATTERN.test(suffix), 'destination environment suffix is invalid');
  return `${environmentId}/nx-${suffix}-communications_dev`;
}

function declaredRepositoryIds(protocols) {
  assert(Array.isArray(protocols) && protocols.length >= 1, 'supported_protocols: nonempty array required');
  const identities = new Set();
  for (const [index, protocol] of protocols.entries()) {
    exactKeys(protocol, ['protocol_id', 'version', 'tag', 'repository_url'], `supported_protocols[${index}]`);
    assert(SLUG_PATTERN.test(protocol.protocol_id) && SEMVER_PATTERN.test(protocol.version) && TAG_PATTERN.test(protocol.tag), `supported_protocols[${index}]: identity invalid`);
    const url = new URL(protocol.repository_url);
    const segments = url.pathname.split('/').filter(Boolean);
    assert(url.protocol === 'https:' && url.hostname === 'github.com' && !url.search && !url.hash && segments.length === 2, `supported_protocols[${index}]: public GitHub repository URL required`);
    const identity = `${segments[0]}/${segments[1]}`.toLowerCase();
    assert(!identities.has(identity), 'supported_protocols: duplicate repository');
    identities.add(identity);
  }
  return identities;
}

function validatePublicRepositoryReferences(text, approved) {
  for (const match of text.matchAll(GITHUB_REPOSITORY_URL_PATTERN)) {
    assert(approved.has(`${match[2]}/${match[3]}`.toLowerCase()), 'tracked content contains an undeclared GitHub repository URL');
  }
}

function validateAutostartInstruction(instruction, authenticatedOwner) {
  assert(typeof instruction === 'string' && !/[\r\n]/.test(instruction), 'Autostart instruction must be one line');
  const match = instruction.match(/^Initialize NX environment ([a-z0-9]+(?:-[a-z0-9]+)*) from (https:\/\/\S+)$/);
  assert(match && match[2] === AUTOSTART_URL, `Autostart must use immutable ${TAG}`);
  assert(authenticatedOwner === match[1], 'authenticated GitHub owner must exactly match requested environment');
  assert(!match[2].includes(match[1]) && !match[2].includes('/main/'), 'universal installer URL must be immutable and environment-neutral');
  return { requestedEnvironment: match[1], repository: expectedDestinationRepository(match[1]) };
}

function validateMission(mission) {
  exactKeys(mission, MISSION_FIELDS, 'mission/norms-exchange-mission.json');
  assert(mission.$schema === '../schemas/mission.schema.json', 'mission schema reference mismatch');
  assert(mission.mission_id === 'norms-exchange-marketplace' && mission.mission_version === '1.0.0' && mission.immutability === 'permanent', 'permanent mission identity mismatch');
  assert(mission.business_purpose === 'Norms Exchange connects evidence-backed film-equipment supply and demand between Los Angeles and the wider United States and Vietnam through governed WTS and WTB marketplace workflows.', 'mission business purpose changed');
  exactArray(mission.marketplace_modes, ['WTS', 'WTB'], 'mission marketplace modes');
  exactKeys(mission.market_corridor, ['supply_origin', 'destination_market'], 'mission market corridor');
  assert(mission.market_corridor.supply_origin === 'Los Angeles and the United States' && mission.market_corridor.destination_market === 'Vietnam', 'mission market corridor changed');
  exactArray(mission.equipment_scope, MISSION_EQUIPMENT, 'mission equipment scope');
  exactArray(mission.norms_services, MISSION_SERVICES, 'mission services');
  exactArray(mission.evidence_rules, MISSION_EVIDENCE, 'mission evidence rules');
  exactArray(mission.prohibited_actions, MISSION_PROHIBITIONS, 'mission prohibitions');
  assert(mission.authority_rule === 'This permanent mission cannot be invented changed replaced or expanded by an environment role message or temporary goal. Roles and temporary goals are separate artifacts that may only narrow work within existing authority.', 'mission authority rule changed');
}

function validateAgentManifest(manifest, actualRepository) {
  exactKeys(manifest, AGENT_FIELDS, 'agent-manifest.json');
  assert(manifest.$schema === './schemas/agent-manifest.schema.json' && manifest.communications_version === VERSION, 'agent manifest schema or version mismatch');
  exactKeys(manifest.protocol_source, ['repository', 'version', 'tag'], 'agent-manifest.json.protocol_source');
  assert(manifest.protocol_source.repository === SOURCE_REPOSITORY && manifest.protocol_source.version === VERSION && manifest.protocol_source.tag === TAG, 'protocol source must remain immutable');
  assert(['source', 'destination'].includes(manifest.protocol_role), 'invalid protocol role');
  assert(SLUG_PATTERN.test(manifest.environment_id) && SLUG_PATTERN.test(manifest.github_owner.toLowerCase()), 'manifest environment or owner invalid');
  assert(REPOSITORY_PATTERN.test(manifest.communications_repository), 'communications repository name invalid');
  assert(typeof manifest.environment_type === 'string' && ENVIRONMENT_TYPE_PATTERN.test(manifest.environment_type), 'environment type invalid');
  exactKeys(manifest.access_model, ['public_read', 'owner_write_only', 'external_write'], 'agent-manifest.json.access_model');
  assert(manifest.access_model.public_read === true && manifest.access_model.owner_write_only === true && manifest.access_model.external_write === false, 'owner-write/public-read access model mismatch');
  assert(manifest.role_branch_grammar === ROLE_BRANCH_GRAMMAR, 'role branch grammar mismatch');
  exactArray(manifest.public_capabilities, EXPECTED_CAPABILITIES, 'manifest capabilities');
  exactArray(manifest.public_safety_boundaries, EXPECTED_BOUNDARIES, 'manifest safety boundaries');
  exactKeys(manifest.mission, ['mission_id', 'mission_version', 'document', 'machine_readable', 'immutability'], 'agent-manifest.json.mission');
  assert(JSON.stringify(manifest.mission) === JSON.stringify({ mission_id: 'norms-exchange-marketplace', mission_version: '1.0.0', document: 'mission/NORMS_EXCHANGE_MISSION.md', machine_readable: 'mission/norms-exchange-mission.json', immutability: 'permanent' }), 'manifest mission reference changed');
  assert(manifest.bootstrap_document === 'bootstrap/AGENT_BOOTSTRAP_dev.md' && validDateTime(manifest.updated_at), 'manifest bootstrap or timestamp invalid');
  const protocols = new Map(manifest.supported_protocols.map((item) => [item.protocol_id, item]));
  assert(protocols.size === manifest.supported_protocols.length, 'duplicate supported protocol ID');
  assert(JSON.stringify(protocols.get('nx-communications')) === JSON.stringify({ protocol_id: 'nx-communications', version: VERSION, tag: TAG, repository_url: `https://github.com/${SOURCE_REPOSITORY}` }), 'communications protocol reference mismatch');
  assert(JSON.stringify(protocols.get('nx-sourcing-contract')) === JSON.stringify({ protocol_id: 'nx-sourcing-contract', version: '0.2.0', tag: 'contract-v0.2.0', repository_url: 'https://github.com/normsexchange-dev/nx-sourcing-contracts_dev' }), 'sourcing protocol reference mismatch');
  assert(protocols.size === 2, 'unexpected supported protocol');
  if (manifest.protocol_role === 'source') {
    assert(manifest.environment_id === 'normsexchange-codex' && manifest.github_owner === 'normsexchange-dev' && manifest.communications_repository === SOURCE_REPOSITORY, 'source identity mismatch');
    assert(manifest.environment_type === 'Codex' && manifest.status === 'ready', 'source type or status mismatch');
  } else {
    assert(manifest.environment_id === manifest.github_owner, 'destination environment must equal authenticated owner');
    assert(manifest.communications_repository === expectedDestinationRepository(manifest.environment_id), 'destination repository identity mismatch');
    assert(actualRepository === manifest.communications_repository, 'actual repository does not match destination manifest');
    assert(['initializing', 'ready', 'maintenance', 'retired'].includes(manifest.status), 'destination status invalid');
  }
  assert(actualRepository === manifest.communications_repository, 'actual repository binding mismatch');
  return declaredRepositoryIds(manifest.supported_protocols);
}

function validateProtocolReferences(value, label) {
  assert(Array.isArray(value) && value.length >= 1, `${label}: nonempty array required`);
  const ids = new Set();
  for (const [index, item] of value.entries()) {
    exactKeys(item, ['protocol_id', 'version', 'tag'], `${label}[${index}]`);
    assert(SLUG_PATTERN.test(item.protocol_id) && SEMVER_PATTERN.test(item.version) && TAG_PATTERN.test(item.tag), `${label}[${index}]: invalid protocol reference`);
    assert(!ids.has(item.protocol_id), `${label}: duplicate protocol ID`);
    ids.add(item.protocol_id);
  }
  const communications = value.find((item) => item.protocol_id === 'nx-communications');
  assert(communications?.version === VERSION && communications?.tag === TAG, `${label}: current communications protocol required`);
}

function validateRoleManifest(value, label = 'role-manifest.json') {
  exactKeys(value, ROLE_FIELDS, label);
  assert(SLUG_PATTERN.test(value.role_id) && SLUG_PATTERN.test(value.originating_environment), `${label}: invalid role or environment identity`);
  bounded(value.role_name, `${label}.role_name`, 120); bounded(value.purpose, `${label}.purpose`); bounded(value.goal, `${label}.goal`);
  assert(value.bootstrap_version === VERSION && value.communications_version === VERSION, `${label}: version mismatch`);
  enumArray(value.allowed_inputs, ALLOWED_INPUTS, `${label}.allowed_inputs`);
  enumArray(value.expected_outputs, EXPECTED_OUTPUTS, `${label}.expected_outputs`);
  assert(value.data_classification === 'public_only', `${label}: public_only required`);
  enumArray(value.allowed_actions, ALLOWED_ACTIONS, `${label}.allowed_actions`);
  enumArray(value.prohibited_actions, new Set(PROHIBITED_ACTIONS), `${label}.prohibited_actions`);
  assert(value.prohibited_actions.length === PROHIBITED_ACTIONS.length, `${label}: every prohibition required`);
  validateProtocolReferences(value.supported_protocol_versions, `${label}.supported_protocol_versions`);
  assert(validDateTime(value.created_at) && ROLE_STATUSES.has(value.status), `${label}: timestamp or status invalid`);
}

function validateMessage(value, environmentId, label = 'message') {
  exactKeys(value, MESSAGE_FIELDS, label);
  assert(value.protocol_version === VERSION && MESSAGE_ID_PATTERN.test(value.message_id), `${label}: version or message ID invalid`);
  assert(value.sender_environment === environmentId && SLUG_PATTERN.test(value.recipient_environment), `${label}: sender or recipient identity invalid`);
  assert(MESSAGE_TYPES.has(value.message_type), `${label}: unsupported message type`);
  nullablePattern(value.role_id, SLUG_PATTERN, `${label}.role_id`);
  nullablePattern(value.role_branch, ROLE_BRANCH_PATTERN, `${label}.role_branch`);
  assert((value.role_id === null) === (value.role_branch === null), `${label}: role ID and branch must be paired`);
  if (value.role_branch) {
    const role = parseBranchName(value.role_branch);
    assert(role.kind === 'role' && role.roleSlug === value.role_id, `${label}: role identity mismatch`);
  }
  assert(validDateTime(value.created_at), `${label}: invalid timestamp`);
  nullablePattern(value.in_reply_to, MESSAGE_ID_PATTERN, `${label}.in_reply_to`);
  nullablePattern(value.supported_contract_version, TAG_PATTERN, `${label}.supported_contract_version`);
  bounded(value.public_summary, `${label}.public_summary`);
  assert(value.payload_classification === 'public_sanitized', `${label}: public_sanitized payload required`);
  assert(value.payload_reference === null || (URL.canParse(value.payload_reference) && new URL(value.payload_reference).protocol === 'https:'), `${label}: payload reference invalid`);
  nullablePattern(value.payload_sha256, SHA256_PATTERN, `${label}.payload_sha256`);
  assert((value.payload_reference === null) === (value.payload_sha256 === null), `${label}: payload reference and hash must be paired`);
  nullablePattern(value.supersedes_message_id, MESSAGE_ID_PATTERN, `${label}.supersedes_message_id`);
  assert(value.in_reply_to !== value.message_id && value.supersedes_message_id !== value.message_id, `${label}: self-reference prohibited`);
  assert(MESSAGE_STATUSES.has(value.status), `${label}: invalid status`);
}

function validateAllowedFiles(relativeFiles, branch) {
  const fileSet = new Set(relativeFiles);
  assert(fileSet.size === relativeFiles.length, 'duplicate repository path');
  for (const required of REQUIRED_CORE_FILES) assert(fileSet.has(required), `required core file missing: ${required}`);
  for (const relativePath of relativeFiles) assert(CORE_FILE_SET.has(relativePath) || relativePath === 'role-manifest.json' || MESSAGE_PATH_PATTERN.test(relativePath), `unexpected repository path: ${relativePath}`);
  if (branch.kind === 'role') assert(fileSet.has('role-manifest.json'), 'role-manifest.json required on role branch');
  else assert(!fileSet.has('role-manifest.json'), 'role-manifest.json prohibited outside role branch');
}

function validateRoles(index, branch, roleManifest, environmentId) {
  exactKeys(index, ['communications_version', 'roles'], 'roles/index.json');
  assert(index.communications_version === VERSION && Array.isArray(index.roles), 'roles index version or array invalid');
  if (branch.kind !== 'role') return assert(index.roles.length === 0, 'roles index must be empty outside role branches');
  validateRoleManifest(roleManifest);
  assert(roleManifest.role_id === branch.roleSlug && roleManifest.originating_environment === environmentId, 'role manifest branch or environment mismatch');
  assert(index.roles.length === 1, 'role branch must index exactly one role');
  exactKeys(index.roles[0], ['role_id', 'branch', 'status'], 'roles index entry');
  assert(index.roles[0].role_id === roleManifest.role_id && index.roles[0].branch === branch.name && index.roles[0].status === roleManifest.status, 'role index entry mismatch');
}

function validateMessages(relativeFiles, messagesByPath, index, branch, roleManifest, environmentId) {
  exactKeys(index, ['communications_version', 'messages'], 'outbox/index.json');
  assert(index.communications_version === VERSION && Array.isArray(index.messages), 'outbox index version or array invalid');
  const storedById = new Map();
  for (const relativePath of relativeFiles.filter((item) => MESSAGE_PATH_PATTERN.test(item)).sort()) {
    const message = messagesByPath.get(relativePath);
    validateMessage(message, environmentId, relativePath);
    assert(relativePath.match(MESSAGE_PATH_PATTERN)[1] === message.message_id, `${relativePath}: filename mismatch`);
    assert(!storedById.has(message.message_id), `duplicate message ID: ${message.message_id}`);
    if (branch.kind !== 'role') assert(message.role_id === null && message.role_branch === null, `${relativePath}: role identity prohibited on this branch`);
    if (branch.kind === 'role' && message.role_id !== null) assert(message.role_id === roleManifest.role_id && message.role_branch === branch.name, `${relativePath}: active role identity mismatch`);
    storedById.set(message.message_id, { path: relativePath, message });
  }
  let previous = null;
  const indexed = new Set();
  for (const [position, entry] of index.messages.entries()) {
    const label = `outbox/index.json.messages[${position}]`;
    exactKeys(entry, ['message_id', 'path', 'created_at', 'status'], label);
    assert(MESSAGE_ID_PATTERN.test(entry.message_id) && !indexed.has(entry.message_id), `${label}: invalid or duplicate message ID`);
    assert(previous === null || previous.localeCompare(entry.message_id) < 0, 'outbox index must be sorted by message ID');
    const stored = storedById.get(entry.message_id);
    assert(stored && stored.path === entry.path && stored.message.created_at === entry.created_at && stored.message.status === entry.status, `${label}: dangling or mismatched entry`);
    indexed.add(entry.message_id); previous = entry.message_id;
  }
  for (const id of storedById.keys()) assert(indexed.has(id), `unindexed message: ${id}`);
  return [...storedById.values()].map((item) => item.message);
}

function validateDynamicState({ branchName, relativeFiles, roleManifest, rolesIndex, messagesByPath, outboxIndex, environmentId }) {
  const branch = parseBranchName(branchName);
  validateAllowedFiles(relativeFiles, branch);
  validateRoles(rolesIndex, branch, roleManifest, environmentId);
  const messages = validateMessages(relativeFiles, messagesByPath, outboxIndex, branch, roleManifest, environmentId);
  return { branch, messages };
}

function validateDestinationMissionAcknowledgment(manifest, messages) {
  if (manifest.protocol_role !== 'destination') return;
  const expected = 'Acknowledged permanent mission norms-exchange-marketplace version 1.0.0 unchanged.';
  const acknowledgments = messages.filter((message) => message.message_type === 'acknowledgment' && message.role_id === null && message.public_summary === expected);
  assert(acknowledgments.length === 1, 'destination must contain exactly one indexed permanent-mission acknowledgment');
}

function validateSchema(schema, name, required) {
  assert(schema.$schema === DRAFT && schema.$id === `${TAGGED_SCHEMA_ROOT}/${name}`, `${name}: immutable Draft 2020-12 identity mismatch`);
  assert(schema.type === 'object' && schema.additionalProperties === false && Array.isArray(schema.required), `${name}: restrictive object schema required`);
  for (const field of required) assert(schema.required.includes(field), `${name}: missing required field ${field}`);
}

function validateReleaseEvidence(evidence) {
  exactKeys(evidence, ['ref_name', 'ref_object_type', 'target_object_type'], 'release evidence');
  assert(evidence.ref_name === TAG && evidence.ref_object_type === 'tag' && evidence.target_object_type === 'commit', 'release must be an annotated tag object targeting a commit');
}

function validateReadinessEvidence(evidence) {
  exactKeys(evidence, ['workflow_file_present', 'workflow_runs', 'initializing_conclusion', 'ready_conclusion', 'local_validation', 'status'], 'readiness evidence');
  assert(evidence.workflow_file_present === true && Number.isInteger(evidence.workflow_runs) && evidence.workflow_runs >= 2, 'workflow must exist and run for initializing and ready states');
  assert(evidence.initializing_conclusion === 'success' && evidence.ready_conclusion === 'success' && evidence.local_validation === 'success', 'all readiness validation must succeed');
  assert(evidence.status === 'ready', 'ready status required');
}

function validatePortabilityEvidence(evidence) {
  exactKeys(evidence, ['source_supported', 'destination_supported'], 'validator portability evidence');
  assert(evidence.source_supported === true && evidence.destination_supported === true, 'validator must support both source and destination identities');
}

function validRole() {
  return { role_id: 'research', role_name: 'Public Research', purpose: 'Bounded public research.', goal: 'Return sanitized status.', originating_environment: 'example-environment', bootstrap_version: VERSION, communications_version: VERSION, allowed_inputs: ['immutable_public_protocol'], expected_outputs: ['sanitized_status'], data_classification: 'public_only', allowed_actions: ['research_public_information'], prohibited_actions: [...PROHIBITED_ACTIONS], supported_protocol_versions: [{ protocol_id: 'nx-communications', version: VERSION, tag: TAG }], created_at: '2026-01-01T00:00:00Z', status: 'active' };
}

function validMessage(overrides = {}) {
  return { protocol_version: VERSION, message_id: 'msg-fixture0000000001', sender_environment: 'example-environment', recipient_environment: 'other-environment', message_type: 'status', role_id: null, role_branch: null, created_at: '2026-01-01T00:00:00Z', in_reply_to: null, supported_contract_version: null, public_summary: 'Sanitized fixture status.', payload_classification: 'public_sanitized', payload_reference: null, payload_sha256: null, supersedes_message_id: null, status: 'published', ...overrides };
}

function fixtureState({ branchName = 'main', roleManifest = null, messages = [], rolesIndexOverride = null, outboxIndexOverride = null, environmentId = 'example-environment' } = {}) {
  const relativeFiles = [...REQUIRED_CORE_FILES];
  if (roleManifest) relativeFiles.push('role-manifest.json');
  const rolesIndex = rolesIndexOverride || { communications_version: VERSION, roles: roleManifest ? [{ role_id: roleManifest.role_id, branch: branchName, status: roleManifest.status }] : [] };
  const messagesByPath = new Map();
  const outboxIndex = outboxIndexOverride || { communications_version: VERSION, messages: [] };
  for (const message of messages) {
    const messagePath = `outbox/messages/${message.message_id}.json`;
    relativeFiles.push(messagePath); messagesByPath.set(messagePath, message);
    if (!outboxIndexOverride) outboxIndex.messages.push({ message_id: message.message_id, path: messagePath, created_at: message.created_at, status: message.status });
  }
  return { branchName, relativeFiles, roleManifest, rolesIndex, messagesByPath, outboxIndex, environmentId };
}

function expectReject(label, callback) {
  let rejected = false;
  try { callback(); } catch { rejected = true; }
  assert(rejected, `regression was accepted: ${label}`);
}

function runRegression(mutation) {
  const role = validRole();
  const message = validMessage();
  if (mutation === 'short_message_id') return validateMessage({ ...message, message_id: 'msg-init-001' }, 'example-environment');
  if (mutation === 'unsupported_initialization_ack') return validateMessage({ ...message, message_type: 'initialization_ack' }, 'example-environment');
  if (mutation === 'wrong_or_missing_envelope_fields') { const invalid = { ...message, payload: {} }; delete invalid.payload_sha256; return validateMessage(invalid, 'example-environment'); }
  if (mutation === 'invalid_outbox_index') return validateDynamicState(fixtureState({ messages: [message], outboxIndexOverride: { communications_version: VERSION, messages: [{ id: message.message_id }] } }));
  if (mutation === 'nonconforming_role_manifest') { const invalid = { ...role }; delete invalid.purpose; return validateRoleManifest(invalid); }
  if (mutation === 'empty_role_index') return validateDynamicState(fixtureState({ branchName: 'role/research/public-records', roleManifest: role, rolesIndexOverride: { communications_version: VERSION, roles: [] } }));
  if (mutation === 'source_bound_validator') return validatePortabilityEvidence({ source_supported: true, destination_supported: false });
  if (mutation === 'missing_or_unrun_workflow') return validateReadinessEvidence({ workflow_file_present: false, workflow_runs: 0, initializing_conclusion: null, ready_conclusion: null, local_validation: 'success', status: 'ready' });
  if (mutation === 'ready_before_validation') return validateReadinessEvidence({ workflow_file_present: true, workflow_runs: 1, initializing_conclusion: 'success', ready_conclusion: null, local_validation: 'failed', status: 'ready' });
  if (mutation === 'lightweight_release_tag') return validateReleaseEvidence({ ref_name: TAG, ref_object_type: 'commit', target_object_type: 'commit' });
  throw new Error(`unknown regression mutation: ${mutation}`);
}

const branchName = parseBranchArgument();
const files = await findFiles();
const relativeFiles = files.map((file) => path.relative(root, file).split(path.sep).join('/')).sort();
const jsonFiles = relativeFiles.filter((file) => file.endsWith('.json'));
const parsed = new Map();
for (const relativePath of jsonFiles) parsed.set(relativePath, await readJson(relativePath));
assert((await readFile(path.join(root, 'COMMUNICATIONS_VERSION'), 'utf8')).trim() === VERSION, 'COMMUNICATIONS_VERSION mismatch');

const manifest = parsed.get('agent-manifest.json');
const actualRepository = process.env.NX_COMMUNICATIONS_REPOSITORY || process.env.GITHUB_REPOSITORY || manifest.communications_repository;
const approvedRepositories = validateAgentManifest(manifest, actualRepository);
validateMission(parsed.get('mission/norms-exchange-mission.json'));

const roleManifest = parsed.get('role-manifest.json') || null;
const messagesByPath = new Map([...parsed].filter(([relativePath]) => MESSAGE_PATH_PATTERN.test(relativePath)));
const dynamic = validateDynamicState({ branchName, relativeFiles, roleManifest, rolesIndex: parsed.get('roles/index.json'), messagesByPath, outboxIndex: parsed.get('outbox/index.json'), environmentId: manifest.environment_id });
validateDestinationMissionAcknowledgment(manifest, dynamic.messages);

const agentSchema = parsed.get('schemas/agent-manifest.schema.json');
const roleSchema = parsed.get('schemas/role-manifest.schema.json');
const messageSchema = parsed.get('schemas/message-envelope.schema.json');
const missionSchema = parsed.get('schemas/mission.schema.json');
validateSchema(agentSchema, 'agent-manifest.schema.json', AGENT_FIELDS);
validateSchema(roleSchema, 'role-manifest.schema.json', ROLE_FIELDS);
validateSchema(messageSchema, 'message-envelope.schema.json', MESSAGE_FIELDS);
validateSchema(missionSchema, 'mission.schema.json', MISSION_FIELDS);
assert(agentSchema.properties.environment_type.pattern === ENVIRONMENT_TYPE_PATTERN.source && !('const' in agentSchema.properties.environment_type), 'environment type schema must remain vendor-neutral');
assert(agentSchema.properties.protocol_source.properties.repository.const === SOURCE_REPOSITORY, 'schema protocol source changed');
assert(roleSchema.properties.bootstrap_version.const === VERSION && messageSchema.properties.protocol_version.const === VERSION, 'role or message schema version mismatch');
assert(missionSchema.properties.immutability.const === 'permanent', 'mission schema immutability changed');

const readme = await readFile(path.join(root, 'README.md'), 'utf8');
assert(readme.split(CANONICAL_AUTOSTART_PROMPT).length - 1 === 1, 'README must contain canonical Autostart prompt exactly once');
validateAutostartInstruction(CANONICAL_AUTOSTART_PROMPT, 'normsexchange-gemini');
const autostart = await readFile(path.join(root, 'AUTOSTART.md'), 'utf8');
assert(autostart.length >= 1 && autostart.length <= 3000, 'AUTOSTART.md must remain concise');
for (const phrase of ['model-agnostic', 'annotated tag object', 'both permanent mission files completely', 'before any mutation', 'exactly equal the requested environment', 'materialize the exact tagged 20-path core', 'copy 19 files unchanged', 'adapt only the seven destination identity/state fields', 'status: "initializing"', 'schema-valid indexed mission acknowledgment', 'missing, unavailable, unrun, failed, or unverifiable validation is no-go', 'before reporting ready', 'before creating any role']) assert(autostart.toLowerCase().includes(phrase), `AUTOSTART.md missing required instruction: ${phrase}`);

const workflow = await readFile(path.join(root, '.github/workflows/validate-communications.yml'), 'utf8');
assert(/permissions:\s*\r?\n\s+contents:\s*read/.test(workflow) && !/permissions:[\s\S]*?contents:\s*write/.test(workflow), 'workflow must use read-only contents permission');
assert(workflow.includes('NX_COMMUNICATIONS_REPOSITORY: ${{ github.repository }}') && workflow.includes('NX_COMMUNICATIONS_BRANCH: ${{ github.head_ref || github.ref_name }}'), 'workflow must bind actual repository and branch');
assert(!/\bsecrets\./.test(workflow), 'workflow must not use secrets');

const regressions = parsed.get('tests/destination-bootstrap-regressions.json');
exactKeys(regressions, ['communications_version', 'fixture_model', 'cases'], 'destination regressions');
assert(regressions.communications_version === VERSION && regressions.fixture_model === 'destination_bootstrap_rejections', 'regression catalog identity mismatch');
exactArray(regressions.cases.map((item) => item.mutation), REGRESSION_MUTATIONS, 'regression coverage');
for (const item of regressions.cases) {
  exactKeys(item, ['case_id', 'mutation', 'expected'], `regression ${item.case_id}`);
  assert(item.expected === 'reject', `regression ${item.case_id}: reject expected`);
  expectReject(item.case_id, () => runRegression(item.mutation));
}
validatePortabilityEvidence({ source_supported: true, destination_supported: true });
const destinationManifest = structuredClone(manifest);
Object.assign(destinationManifest, {
  protocol_role: 'destination',
  environment_id: 'normsexchange-gemini',
  github_owner: 'normsexchange-gemini',
  communications_repository: 'normsexchange-gemini/nx-gemini-communications_dev',
  environment_type: 'Gemini',
  status: 'initializing',
  updated_at: '2026-01-01T00:00:00Z'
});
validateAgentManifest(destinationManifest, destinationManifest.communications_repository);
const destinationAcknowledgment = validMessage({
  message_id: 'msg-mission-acknowledgment-0001',
  sender_environment: destinationManifest.environment_id,
  recipient_environment: 'normsexchange-codex',
  message_type: 'acknowledgment',
  public_summary: 'Acknowledged permanent mission norms-exchange-marketplace version 1.0.0 unchanged.'
});
const destinationState = validateDynamicState(fixtureState({ messages: [destinationAcknowledgment], environmentId: destinationManifest.environment_id }));
validateDestinationMissionAcknowledgment(destinationManifest, destinationState.messages);
validateReleaseEvidence({ ref_name: TAG, ref_object_type: 'tag', target_object_type: 'commit' });
validateReadinessEvidence({ workflow_file_present: true, workflow_runs: 2, initializing_conclusion: 'success', ready_conclusion: 'success', local_validation: 'success', status: 'ready' });

const allText = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
validatePublicRepositoryReferences(allText, approvedRepositories);
assert(!/[A-Za-z]:[\\/]Users[\\/]/.test(allText), 'local Windows user path found');
assert(!/(?:^|\s)\/(?:home|Users)\/[A-Za-z0-9._-]+\//m.test(allText), 'local POSIX user path found');
assert(!/(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|private[_-]?key)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{12,}/i.test(allText), 'credential-like value found');
const validatorSource = await readFile(fileURLToPath(import.meta.url), 'utf8');
for (const token of [['node', ':http'].join(''), ['node', ':https'].join(''), ['f', 'etch('].join(''), ['Open', 'AI'].join(''), ['model', '.generate'].join('')]) assert(!validatorSource.includes(token), `validator contains prohibited network or model token: ${token}`);
for (const match of validatorSource.matchAll(/^import .* from ['"]([^'"]+)['"];$/gm)) assert(match[1].startsWith('node:'), `third-party import found: ${match[1]}`);

console.log(`validate-communications: PASS (${relativeFiles.length} files; ${jsonFiles.length} JSON; communications ${VERSION}; ${manifest.protocol_role}; branch ${branchName}; roles ${dynamic.branch.kind === 'role' ? 1 : 0}; messages ${dynamic.messages.length}; destination regressions ${regressions.cases.length})`);
