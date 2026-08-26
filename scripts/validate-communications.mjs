import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '0.2.0';
const TAG = `communications-v${VERSION}`;
const DRAFT = 'https://json-schema.org/draft/2020-12/schema';
const REPOSITORY = 'normsexchange-dev/nx-codex-communications_dev';
const TAGGED_SCHEMA_ROOT = `https://raw.githubusercontent.com/${REPOSITORY}/${TAG}/schemas`;
const AUTOSTART_URL = `https://raw.githubusercontent.com/${REPOSITORY}/${TAG}/AUTOSTART.md`;
const CANONICAL_AUTOSTART_PROMPT = `Initialize NX environment normsexchange-gemini from ${AUTOSTART_URL}`;
const AUTOSTART_INSTRUCTION_PATTERN = /^Initialize NX environment ([a-z0-9]+(?:-[a-z0-9]+)*) from (https:\/\/\S+)$/;
const ROLE_BRANCH_GRAMMAR = '^role/[a-z0-9]+(?:-[a-z0-9]+)*/[a-z0-9]+(?:-[a-z0-9]+)*$';
const ROLE_BRANCH_PATTERN = new RegExp(ROLE_BRANCH_GRAMMAR);
const ROLE_BRANCH_CAPTURE = /^role\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ENVIRONMENT_TYPE_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._ -]{0,62}[A-Za-z0-9])?$/;
const MESSAGE_ID_PATTERN = /^msg-[a-z0-9][a-z0-9-]{15,79}$/;
const MESSAGE_PATH_PATTERN = /^outbox\/messages\/(msg-[a-z0-9][a-z0-9-]{15,79})\.json$/;
const SEMVER_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const TAG_PATTERN = /^[a-z][a-z0-9-]*-v[0-9]+\.[0-9]+\.[0-9]+$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const PUBLIC_IDENTIFIER_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const GITHUB_REPOSITORY_URL_PATTERN = /https:\/\/(github\.com|raw\.githubusercontent\.com)\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)/g;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_CORE_FILES = [
  '.github/workflows/validate-communications.yml', '.gitignore', 'AUTOSTART.md', 'COMMUNICATIONS_VERSION', 'README.md',
  'agent-manifest.json', 'bootstrap/AGENT_BOOTSTRAP_dev.md', 'docs/MESSAGE_PROTOCOL_dev.md',
  'docs/ROLE_BRANCH_PROTOCOL_dev.md', 'docs/SECURITY_BOUNDARY_dev.md', 'outbox/index.json',
  'roles/index.json', 'schemas/agent-manifest.schema.json', 'schemas/message-envelope.schema.json',
  'schemas/role-manifest.schema.json', 'scripts/validate-communications.mjs'
].sort();
const CORE_FILE_SET = new Set(REQUIRED_CORE_FILES);

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
const ALLOWED_INPUTS = new Set(['immutable_public_protocol', 'public_web_information', 'sanitized_public_message', 'public_repository_content']);
const EXPECTED_OUTPUTS = new Set(['sanitized_public_research', 'sanitized_status', 'sanitized_acknowledgment', 'public_protocol_artifact']);
const ALLOWED_ACTIONS = new Set(['read_immutable_public_protocols', 'research_public_information', 'publish_sanitized_status', 'publish_sanitized_acknowledgment']);
const PROHIBITED_ACTIONS = [
  'outreach', 'third_party_messages', 'purchase_or_sale', 'shopify_mutation',
  'customer_seller_listing_inventory_or_order_creation', 'private_information_publication',
  'credential_access', 'unrelated_repository_access', 'access_control_bypass',
  'destructive_github_operations', 'self_authority_expansion'
];
const ROLE_STATUSES = new Set(['proposed', 'active', 'paused', 'completed', 'cancelled']);
const MESSAGE_TYPES = new Set(['assignment', 'acknowledgment', 'response', 'status', 'correction', 'protocol_notice']);
const MESSAGE_STATUSES = new Set(['published', 'acknowledged', 'superseded']);
const EXPECTED_PUBLIC_CAPABILITIES = [
  'public_protocol_publication', 'sanitized_message_publication', 'bounded_role_declaration',
  'public_information_research_coordination'
];
const EXPECTED_PUBLIC_SAFETY_BOUNDARIES = [
  'public_information_only', 'no_cross_account_writes', 'no_self_authority_expansion',
  'no_private_data_publication', 'no_credentials_or_private_paths'
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

function validateBoundedString(value, label, maxLength = 1000) {
  assert(typeof value === 'string' && value.trim().length >= 1 && value.length <= maxLength, `${label}: bounded nonempty string required`);
}

function validateEnvironmentType(value, label = 'environment_type') {
  assert(typeof value === 'string' && value.length >= 1 && value.length <= 64 && ENVIRONMENT_TYPE_PATTERN.test(value), `${label}: invalid environment type`);
}

function validateEnumArray(value, allowed, label) {
  assert(Array.isArray(value) && value.length >= 1, `${label}: nonempty array required`);
  assert(new Set(value).size === value.length, `${label}: duplicate value`);
  for (const item of value) assert(typeof item === 'string' && allowed.has(item), `${label}: invalid value: ${item}`);
}

function validatePublicIdentifierArray(value, label) {
  assert(Array.isArray(value) && value.length >= 1, `${label}: nonempty array required`);
  assert(new Set(value).size === value.length, `${label}: duplicate value`);
  for (const item of value) assert(typeof item === 'string' && PUBLIC_IDENTIFIER_PATTERN.test(item), `${label}: invalid public identifier`);
}

function declaredPublicRepositoryIds(supportedProtocols, label = 'supported_protocols') {
  assert(Array.isArray(supportedProtocols) && supportedProtocols.length >= 1, `${label}: nonempty array required`);
  const identities = new Set();
  for (const [index, protocol] of supportedProtocols.entries()) {
    const itemLabel = `${label}[${index}].repository_url`;
    assert(typeof protocol.repository_url === 'string' && URL.canParse(protocol.repository_url), `${itemLabel}: valid URL required`);
    const repositoryUrl = new URL(protocol.repository_url);
    const segments = repositoryUrl.pathname.split('/').filter(Boolean);
    assert(repositoryUrl.protocol === 'https:' && repositoryUrl.hostname === 'github.com', `${itemLabel}: public GitHub URL required`);
    assert(repositoryUrl.username === '' && repositoryUrl.password === '' && repositoryUrl.port === '' && repositoryUrl.search === '' && repositoryUrl.hash === '', `${itemLabel}: URL credentials, ports, query, and fragment are prohibited`);
    assert(segments.length === 2 && /^[A-Za-z0-9-]+$/.test(segments[0]) && /^[A-Za-z0-9._-]+$/.test(segments[1]), `${itemLabel}: owner/repository path required`);
    const identity = `${segments[0]}/${segments[1]}`.toLowerCase();
    assert(!identities.has(identity), `${label}: duplicate public repository identity`);
    identities.add(identity);
  }
  return identities;
}

function validatePublicRepositoryReferences(text, approvedRepositoryIds, label = 'tracked public content') {
  assert(typeof text === 'string', `${label}: text required`);
  for (const match of text.matchAll(GITHUB_REPOSITORY_URL_PATTERN)) {
    const identity = `${match[2]}/${match[3]}`.toLowerCase();
    assert(approvedRepositoryIds.has(identity), `${label}: undeclared GitHub repository URL`);
  }
}

function validateAutostartInstruction(instruction, authenticatedOwner) {
  assert(typeof instruction === 'string' && !/[\r\n]/.test(instruction), 'Autostart instruction must be exactly one line');
  const match = instruction.match(AUTOSTART_INSTRUCTION_PATTERN);
  assert(match, 'Autostart instruction must include one requested environment and one HTTPS URL');
  const requestedEnvironment = match[1];
  const installerUrl = match[2];
  assert(installerUrl === AUTOSTART_URL, `Autostart URL must use immutable ${TAG}`);
  const parsedUrl = new URL(installerUrl);
  assert(parsedUrl.protocol === 'https:' && parsedUrl.hostname === 'raw.githubusercontent.com', 'Autostart URL must use raw GitHub HTTPS');
  assert(!parsedUrl.pathname.split('/').includes('main'), 'Autostart URL must not use mutable main');
  assert(!installerUrl.includes(requestedEnvironment), 'requested environment must remain outside the universal installer URL');
  assert(typeof authenticatedOwner === 'string' && authenticatedOwner.length >= 1, 'authenticated GitHub owner is required before mutation');
  assert(authenticatedOwner === requestedEnvironment, 'authenticated GitHub owner must exactly match requested environment');
  return { requestedEnvironment, installerUrl, resourceOwner: authenticatedOwner };
}

function parseBranchName(branchName) {
  assert(typeof branchName === 'string' && branchName.length >= 1 && branchName.length <= 255 && !/\s/.test(branchName), 'branch name must be explicit and safe');
  if (branchName === 'main') return { kind: 'main', name: branchName };
  const roleMatch = branchName.match(ROLE_BRANCH_CAPTURE);
  if (roleMatch) return { kind: 'role', name: branchName, roleSlug: roleMatch[1], goalSlug: roleMatch[2] };
  assert(!branchName.startsWith('role/'), `malformed role branch: ${branchName}`);
  return { kind: 'maintenance', name: branchName };
}

function parseBranchArgument(argv = process.argv.slice(2), environment = process.env) {
  let branchName = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--branch') {
      assert(index + 1 < argv.length, '--branch requires a value');
      assert(branchName === null, 'branch specified more than once');
      branchName = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--branch=')) {
      assert(branchName === null, 'branch specified more than once');
      branchName = argument.slice('--branch='.length);
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  branchName ||= environment.NX_COMMUNICATIONS_BRANCH || null;
  assert(branchName, 'branch is required through --branch or NX_COMMUNICATIONS_BRANCH');
  return branchName;
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

async function json(relativePath) {
  try {
    return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
  } catch (error) {
    throw new Error(`${relativePath}: invalid JSON: ${error.message}`);
  }
}

function validateAllowedFiles(relativeFiles, branch) {
  const fileSet = new Set(relativeFiles);
  assert(fileSet.size === relativeFiles.length, 'duplicate repository path');
  for (const required of REQUIRED_CORE_FILES) assert(fileSet.has(required), `required core file missing: ${required}`);
  for (const relativePath of relativeFiles) {
    const allowed = CORE_FILE_SET.has(relativePath) || relativePath === 'role-manifest.json' || MESSAGE_PATH_PATTERN.test(relativePath);
    assert(allowed, `unexpected repository path: ${relativePath}`);
  }
  const hasRoleManifest = fileSet.has('role-manifest.json');
  if (branch.kind === 'role') assert(hasRoleManifest, 'role-manifest.json is required on a role branch');
  else assert(!hasRoleManifest, `role-manifest.json is prohibited on ${branch.kind} branches`);
}

function validateProtocolReferences(value, label) {
  assert(Array.isArray(value) && value.length >= 1, `${label}: nonempty array required`);
  const ids = new Set();
  for (const [index, item] of value.entries()) {
    const itemLabel = `${label}[${index}]`;
    exactKeys(item, ['protocol_id', 'version', 'tag'], itemLabel);
    assert(SLUG_PATTERN.test(item.protocol_id), `${itemLabel}: invalid protocol_id`);
    assert(SEMVER_PATTERN.test(item.version), `${itemLabel}: invalid version`);
    assert(TAG_PATTERN.test(item.tag), `${itemLabel}: invalid tag`);
    assert(!ids.has(item.protocol_id), `${label}: duplicate protocol_id`);
    ids.add(item.protocol_id);
  }
  const communications = value.find((item) => item.protocol_id === 'nx-communications');
  assert(communications?.version === VERSION && communications?.tag === TAG, `${label}: current communications protocol required`);
}

function validateRoleManifest(value, label = 'role-manifest.json') {
  exactKeys(value, ROLE_FIELDS, label);
  assert(SLUG_PATTERN.test(value.role_id), `${label}: invalid role_id`);
  validateBoundedString(value.role_name, `${label}.role_name`, 120);
  validateBoundedString(value.purpose, `${label}.purpose`);
  validateBoundedString(value.goal, `${label}.goal`);
  assert(SLUG_PATTERN.test(value.originating_environment), `${label}: invalid originating_environment`);
  assert(value.bootstrap_version === VERSION, `${label}: bootstrap version mismatch`);
  assert(value.communications_version === VERSION, `${label}: communications version mismatch`);
  validateEnumArray(value.allowed_inputs, ALLOWED_INPUTS, `${label}.allowed_inputs`);
  validateEnumArray(value.expected_outputs, EXPECTED_OUTPUTS, `${label}.expected_outputs`);
  assert(value.data_classification === 'public_only', `${label}: data classification must be public_only`);
  validateEnumArray(value.allowed_actions, ALLOWED_ACTIONS, `${label}.allowed_actions`);
  validateEnumArray(value.prohibited_actions, new Set(PROHIBITED_ACTIONS), `${label}.prohibited_actions`);
  assert(value.prohibited_actions.length === PROHIBITED_ACTIONS.length, `${label}: every default prohibition is required`);
  validateProtocolReferences(value.supported_protocol_versions, `${label}.supported_protocol_versions`);
  assert(validDateTime(value.created_at), `${label}: invalid created_at`);
  assert(ROLE_STATUSES.has(value.status), `${label}: invalid status`);
}

function validateNullablePattern(value, pattern, label) {
  assert(value === null || (typeof value === 'string' && pattern.test(value)), `${label}: invalid value`);
}

function validateMessage(value, environmentId, label = 'message') {
  exactKeys(value, MESSAGE_FIELDS, label);
  assert(value.protocol_version === VERSION, `${label}: protocol version mismatch`);
  assert(MESSAGE_ID_PATTERN.test(value.message_id), `${label}: invalid message_id`);
  assert(SLUG_PATTERN.test(value.sender_environment), `${label}: invalid sender_environment`);
  assert(value.sender_environment === environmentId, `${label}: sender_environment must equal the repository environment_id`);
  assert(SLUG_PATTERN.test(value.recipient_environment), `${label}: invalid recipient_environment`);
  assert(MESSAGE_TYPES.has(value.message_type), `${label}: invalid message_type`);
  validateNullablePattern(value.role_id, SLUG_PATTERN, `${label}.role_id`);
  validateNullablePattern(value.role_branch, ROLE_BRANCH_PATTERN, `${label}.role_branch`);
  assert((value.role_id === null) === (value.role_branch === null), `${label}: role_id and role_branch must both be present or both be null`);
  if (value.role_branch !== null) {
    const role = parseBranchName(value.role_branch);
    assert(role.kind === 'role' && role.roleSlug === value.role_id, `${label}: role identity and branch mismatch`);
  }
  assert(validDateTime(value.created_at), `${label}: invalid created_at`);
  validateNullablePattern(value.in_reply_to, MESSAGE_ID_PATTERN, `${label}.in_reply_to`);
  validateNullablePattern(value.supported_contract_version, TAG_PATTERN, `${label}.supported_contract_version`);
  validateBoundedString(value.public_summary, `${label}.public_summary`);
  assert(value.payload_classification === 'public_sanitized', `${label}: payload classification must be public_sanitized`);
  assert(value.payload_reference === null || (typeof value.payload_reference === 'string' && URL.canParse(value.payload_reference) && new URL(value.payload_reference).protocol === 'https:'), `${label}: invalid payload_reference`);
  validateNullablePattern(value.payload_sha256, SHA256_PATTERN, `${label}.payload_sha256`);
  assert((value.payload_reference === null) === (value.payload_sha256 === null), `${label}: payload reference and hash must both be present or both be null`);
  validateNullablePattern(value.supersedes_message_id, MESSAGE_ID_PATTERN, `${label}.supersedes_message_id`);
  assert(value.in_reply_to !== value.message_id, `${label}: message cannot reply to itself`);
  assert(value.supersedes_message_id !== value.message_id, `${label}: message cannot supersede itself`);
  assert(MESSAGE_STATUSES.has(value.status), `${label}: invalid status`);
}

function validateRolesIndex(index, branch, roleManifest, environmentId) {
  exactKeys(index, ['communications_version', 'roles'], 'roles/index.json');
  assert(index.communications_version === VERSION && Array.isArray(index.roles), 'roles/index.json: invalid version or roles');
  if (branch.kind !== 'role') {
    assert(index.roles.length === 0, 'roles/index.json must be empty outside role branches');
    return;
  }
  validateRoleManifest(roleManifest);
  assert(roleManifest.role_id === branch.roleSlug, 'role manifest role_id must equal branch role slug');
  assert(roleManifest.originating_environment === environmentId, 'role manifest originating_environment mismatch');
  assert(index.roles.length === 1, 'role branch must index exactly its current role');
  const entry = index.roles[0];
  exactKeys(entry, ['role_id', 'branch', 'status'], 'roles/index.json entry');
  assert(entry.role_id === roleManifest.role_id, 'role index role_id mismatch');
  assert(entry.branch === branch.name, 'role index branch mismatch');
  assert(entry.status === roleManifest.status, 'role index status mismatch');
}

function validateMessages(relativeFiles, messagesByPath, index, branch, roleManifest, environmentId) {
  exactKeys(index, ['communications_version', 'messages'], 'outbox/index.json');
  assert(index.communications_version === VERSION && Array.isArray(index.messages), 'outbox/index.json: invalid version or messages');
  const messagePaths = relativeFiles.filter((relativePath) => MESSAGE_PATH_PATTERN.test(relativePath)).sort();
  const messagesById = new Map();
  for (const relativePath of messagePaths) {
    assert(messagesByPath.has(relativePath), `message was not parsed: ${relativePath}`);
    const message = messagesByPath.get(relativePath);
    validateMessage(message, environmentId, relativePath);
    const filenameId = relativePath.match(MESSAGE_PATH_PATTERN)[1];
    assert(message.message_id === filenameId, `${relativePath}: filename stem must equal message_id`);
    assert(!messagesById.has(message.message_id), `duplicate message_id: ${message.message_id}`);
    if (branch.kind === 'role') {
      assert(message.role_branch === branch.name && message.role_id === roleManifest.role_id, `${relativePath}: role-branch message identity mismatch`);
    } else {
      assert(message.role_id === null && message.role_branch === null, `${relativePath}: role identity is prohibited outside role branches`);
    }
    messagesById.set(message.message_id, { relativePath, message });
  }

  const indexedIds = new Set();
  let previousId = null;
  for (const [indexPosition, entry] of index.messages.entries()) {
    const label = `outbox/index.json.messages[${indexPosition}]`;
    exactKeys(entry, ['message_id', 'path', 'created_at', 'status'], label);
    assert(MESSAGE_ID_PATTERN.test(entry.message_id), `${label}: invalid message_id`);
    assert(!indexedIds.has(entry.message_id), `${label}: duplicate message_id`);
    assert(previousId === null || previousId.localeCompare(entry.message_id) < 0, 'outbox index must be sorted by message_id');
    const stored = messagesById.get(entry.message_id);
    assert(stored, `${label}: dangling message index entry`);
    assert(entry.path === stored.relativePath, `${label}: path mismatch`);
    assert(entry.created_at === stored.message.created_at, `${label}: created_at mismatch`);
    assert(entry.status === stored.message.status, `${label}: status mismatch`);
    indexedIds.add(entry.message_id);
    previousId = entry.message_id;
  }
  for (const messageId of messagesById.keys()) assert(indexedIds.has(messageId), `unindexed message: ${messageId}`);
}

function validateDynamicState({ branchName, relativeFiles, roleManifest = null, rolesIndex, messagesByPath = new Map(), outboxIndex, environmentId }) {
  const branch = parseBranchName(branchName);
  validateAllowedFiles(relativeFiles, branch);
  validateRolesIndex(rolesIndex, branch, roleManifest, environmentId);
  validateMessages(relativeFiles, messagesByPath, outboxIndex, branch, roleManifest, environmentId);
  return branch;
}

function validateSchema(schema, name, required) {
  assert(schema.$schema === DRAFT, `${name}: must use Draft 2020-12`);
  assert(schema.$id === `${TAGGED_SCHEMA_ROOT}/${name}`, `${name}: immutable schema identity mismatch`);
  assert(schema.type === 'object' && schema.additionalProperties === false, `${name}: restrictive object root required`);
  assert(Array.isArray(schema.required), `${name}: required array missing`);
  for (const field of required) assert(schema.required.includes(field), `${name}: required field missing: ${field}`);
}

function validRoleFixture() {
  return {
    role_id: 'research',
    role_name: 'Public Research',
    purpose: 'Coordinate bounded public-information research.',
    goal: 'Produce one sanitized public status.',
    originating_environment: 'example-environment',
    bootstrap_version: VERSION,
    communications_version: VERSION,
    allowed_inputs: ['immutable_public_protocol'],
    expected_outputs: ['sanitized_status'],
    data_classification: 'public_only',
    allowed_actions: ['research_public_information'],
    prohibited_actions: [...PROHIBITED_ACTIONS],
    supported_protocol_versions: [{ protocol_id: 'nx-communications', version: VERSION, tag: TAG }],
    created_at: '2026-01-01T00:00:00Z',
    status: 'active'
  };
}

function validMessageFixture({
  messageId = 'msg-fixture0000000001',
  senderEnvironment = 'example-environment',
  roleId = null,
  roleBranch = null
} = {}) {
  return {
    protocol_version: VERSION,
    message_id: messageId,
    sender_environment: senderEnvironment,
    recipient_environment: 'other-environment',
    message_type: 'status',
    role_id: roleId,
    role_branch: roleBranch,
    created_at: '2026-01-01T00:00:00Z',
    in_reply_to: null,
    supported_contract_version: null,
    public_summary: 'Sanitized fixture status.',
    payload_classification: 'public_sanitized',
    payload_reference: null,
    payload_sha256: null,
    supersedes_message_id: null,
    status: 'published'
  };
}

function fixtureState({ branchName = 'main', roleManifest = null, message = null, indexMessage = true, extras = [], environmentId = 'example-environment' } = {}) {
  const relativeFiles = [...REQUIRED_CORE_FILES, ...extras];
  const rolesIndex = { communications_version: VERSION, roles: [] };
  if (roleManifest) {
    relativeFiles.push('role-manifest.json');
    rolesIndex.roles.push({ role_id: roleManifest.role_id, branch: branchName, status: roleManifest.status });
  }
  const messagesByPath = new Map();
  const outboxIndex = { communications_version: VERSION, messages: [] };
  if (message) {
    const messagePath = `outbox/messages/${message.message_id}.json`;
    relativeFiles.push(messagePath);
    messagesByPath.set(messagePath, message);
    if (indexMessage) outboxIndex.messages.push({ message_id: message.message_id, path: messagePath, created_at: message.created_at, status: message.status });
  }
  return { branchName, relativeFiles, roleManifest, rolesIndex, messagesByPath, outboxIndex, environmentId };
}

function runSelfTests() {
  let count = 0;
  const pass = (_label, callback) => {
    callback();
    count += 1;
  };
  const fail = (label, callback) => {
    let rejected = false;
    try { callback(); } catch { rejected = true; }
    assert(rejected, `self-test expected rejection: ${label}`);
    count += 1;
  };

  pass('Codex environment type', () => validateEnvironmentType('Codex'));
  pass('Gemini environment type', () => validateEnvironmentType('Gemini'));
  fail('invalid environment type', () => validateEnvironmentType('  '));
  pass('manifest capability and safety identifiers', () => {
    validatePublicIdentifierArray(EXPECTED_PUBLIC_CAPABILITIES, 'fixture.public_capabilities');
    validatePublicIdentifierArray(EXPECTED_PUBLIC_SAFETY_BOUNDARIES, 'fixture.public_safety_boundaries');
  });
  fail('empty manifest safety identifiers', () => validatePublicIdentifierArray([], 'fixture.public_safety_boundaries'));
  fail('duplicate manifest capability identifiers', () => validatePublicIdentifierArray(['public_read', 'public_read'], 'fixture.public_capabilities'));
  pass('valid role branch', () => parseBranchName('role/research/public-records'));
  fail('invalid role branch', () => parseBranchName('role/Research/public-records'));
  const role = validRoleFixture();
  pass('valid role manifest', () => validateDynamicState(fixtureState({ branchName: 'role/research/public-records', roleManifest: role })));
  fail('missing role manifest', () => validateDynamicState(fixtureState({ branchName: 'role/research/public-records' })));
  fail('role manifest on main', () => validateDynamicState(fixtureState({ roleManifest: role })));
  const message = validMessageFixture();
  pass('correct sender identity', () => validateDynamicState(fixtureState({ message })));
  fail('incorrect sender identity', () => validateDynamicState(fixtureState({ message: validMessageFixture({ senderEnvironment: 'incorrect-environment' }) })));
  const roleBranch = 'role/research/public-records';
  const roleMessage = validMessageFixture({ messageId: 'msg-rolefixture000001', roleId: 'research', roleBranch });
  pass('correct role-branch message identity', () => validateDynamicState(fixtureState({ branchName: roleBranch, roleManifest: role, message: roleMessage })));
  fail('incorrect role-branch message identity', () => {
    const mismatched = validMessageFixture({ messageId: 'msg-rolefixture000002', roleId: 'research', roleBranch: 'role/research/other-goal' });
    validateDynamicState(fixtureState({ branchName: roleBranch, roleManifest: role, message: mismatched }));
  });
  fail('role-neutral message on role branch', () => validateDynamicState(fixtureState({ branchName: roleBranch, roleManifest: role, message })));
  fail('role-bound message on main', () => validateDynamicState(fixtureState({ message: roleMessage })));
  fail('role-bound message on maintenance branch', () => validateDynamicState(fixtureState({ branchName: 'maintenance/example', message: roleMessage })));
  fail('message filename mismatch', () => {
    const state = fixtureState({ message });
    const originalPath = `outbox/messages/${message.message_id}.json`;
    const wrongPath = 'outbox/messages/msg-fixture0000000002.json';
    state.relativeFiles[state.relativeFiles.indexOf(originalPath)] = wrongPath;
    state.messagesByPath = new Map([[wrongPath, message]]);
    state.outboxIndex.messages[0].path = wrongPath;
    validateDynamicState(state);
  });
  fail('unindexed message', () => validateDynamicState(fixtureState({ message, indexMessage: false })));
  fail('dangling index entry', () => {
    const state = fixtureState();
    state.outboxIndex.messages.push({ message_id: message.message_id, path: `outbox/messages/${message.message_id}.json`, created_at: message.created_at, status: message.status });
    validateDynamicState(state);
  });
  fail('unexpected path', () => validateDynamicState(fixtureState({ extras: ['unexpected/file.json'] })));
  fail('reference/hash pairing', () => validateDynamicState(fixtureState({ message: { ...message, payload_reference: 'https://example.test/public.json' } })));
  fail('self-referencing reply', () => validateDynamicState(fixtureState({ message: { ...message, in_reply_to: message.message_id } })));
  fail('self-referencing supersession', () => validateDynamicState(fixtureState({ message: { ...message, supersedes_message_id: message.message_id } })));
  fail('duplicate index entry', () => {
    const state = fixtureState({ message });
    state.outboxIndex.messages.push({ ...state.outboxIndex.messages[0] });
    validateDynamicState(state);
  });
  const githubBase = new URL('https://github.com');
  const rawBase = new URL('https://raw.githubusercontent.com');
  const declaredUrl = new URL('/example-owner/public-protocol', githubBase).href;
  const declaredRawUrl = new URL('/example-owner/public-protocol/release/file.json', rawBase).href;
  const fixtureApproved = declaredPublicRepositoryIds([{ repository_url: declaredUrl }], 'fixture.supported_protocols');
  pass('declared public protocol repository URLs', () => validatePublicRepositoryReferences(`${declaredUrl}\n${declaredRawUrl}`, fixtureApproved, 'fixture public references'));
  fail('undeclared example GitHub repository URL', () => {
    const undeclaredUrl = new URL('/example-owner/undeclared-protocol', githubBase).href;
    validatePublicRepositoryReferences(undeclaredUrl, fixtureApproved, 'fixture public references');
  });
  pass('Gemini Autostart identity adaptation', () => {
    const request = validateAutostartInstruction(CANONICAL_AUTOSTART_PROMPT, 'normsexchange-gemini');
    assert(request.requestedEnvironment === 'normsexchange-gemini' && request.resourceOwner === 'normsexchange-gemini', 'Gemini Autostart adaptation mismatch');
  });
  fail('Autostart wrong authenticated identity', () => validateAutostartInstruction(CANONICAL_AUTOSTART_PROMPT, 'normsexchange-dev'));
  fail('Autostart missing environment', () => validateAutostartInstruction(`Initialize NX environment from ${AUTOSTART_URL}`, 'normsexchange-gemini'));
  fail('Autostart mutable main URL', () => validateAutostartInstruction(CANONICAL_AUTOSTART_PROMPT.replace(`/${TAG}/`, '/main/'), 'normsexchange-gemini'));
  return count;
}

const branchName = parseBranchArgument();
const branch = parseBranchName(branchName);
const files = await findFiles();
const relativeFiles = files.map((file) => path.relative(root, file).split(path.sep).join('/')).sort();

const jsonFiles = relativeFiles.filter((file) => file.endsWith('.json'));
const parsedJson = new Map();
for (const relativePath of jsonFiles) parsedJson.set(relativePath, await json(relativePath));

assert((await readFile(path.join(root, 'COMMUNICATIONS_VERSION'), 'utf8')).trim() === VERSION, 'communications version mismatch');

const readmeText = await readFile(path.join(root, 'README.md'), 'utf8');
assert(readmeText.split(CANONICAL_AUTOSTART_PROMPT).length - 1 === 1, 'README must contain the canonical Autostart prompt exactly once');
const autostartText = await readFile(path.join(root, 'AUTOSTART.md'), 'utf8');
assert(autostartText.length >= 1 && autostartText.length <= 3000, 'AUTOSTART.md must remain concise and nonempty');
const requiredAutostartPhrases = [
  'model-agnostic', 'requested destination environment', '/communications-v0.2.0/autostart.md',
  'agent-manifest.json', 'bootstrap document completely', 'immutable public protocols explicitly referenced',
  'before any mutation', 'authenticated account name to exactly equal', 'stop on absent authentication or any mismatch',
  "authenticated account's ownership", 'never write across accounts', 'share credentials', 'adapt the tagged public files truthfully',
  'deterministic validator', 'role-branch', 'sanitized acknowledgment', 'public information only',
  'stop and report public-safe status before substantive role work'
];
const normalizedAutostart = autostartText.toLowerCase();
for (const phrase of requiredAutostartPhrases) assert(normalizedAutostart.includes(phrase), `AUTOSTART.md missing required instruction: ${phrase}`);
assert(!/raw\.githubusercontent\.com\/[^\s)]+\/main\//i.test(autostartText), 'AUTOSTART.md must not contain a mutable raw GitHub URL');
validateAutostartInstruction(CANONICAL_AUTOSTART_PROMPT, 'normsexchange-gemini');

const manifest = parsedJson.get('agent-manifest.json');
exactKeys(manifest, ['$schema', 'communications_version', 'environment_id', 'github_owner', 'communications_repository', 'environment_type', 'access_model', 'role_branch_grammar', 'supported_protocols', 'public_capabilities', 'public_safety_boundaries', 'bootstrap_document', 'status', 'updated_at'], 'agent-manifest.json');
assert(manifest.$schema === './schemas/agent-manifest.schema.json', 'agent manifest schema reference mismatch');
assert(manifest.communications_version === VERSION, 'agent manifest version mismatch');
assert(manifest.environment_id === 'normsexchange-codex', 'environment identifier mismatch');
assert(manifest.github_owner === 'normsexchange-dev', 'GitHub owner mismatch');
assert(manifest.communications_repository === REPOSITORY, 'communications repository mismatch');
validateEnvironmentType(manifest.environment_type, 'agent-manifest.json.environment_type');
assert(manifest.environment_type === 'Codex', 'this repository must truthfully declare Codex');
exactKeys(manifest.access_model, ['public_read', 'owner_write_only', 'external_write'], 'agent-manifest.json.access_model');
assert(manifest.access_model.public_read === true && manifest.access_model.owner_write_only === true && manifest.access_model.external_write === false, 'owner-write/public-read access model mismatch');
assert(manifest.role_branch_grammar === ROLE_BRANCH_GRAMMAR, 'role branch grammar mismatch');
assert(manifest.bootstrap_document === 'bootstrap/AGENT_BOOTSTRAP_dev.md', 'bootstrap document mismatch');
assert(manifest.status === 'ready' && validDateTime(manifest.updated_at), 'environment status or timestamp invalid');
validatePublicIdentifierArray(manifest.public_capabilities, 'agent-manifest.json.public_capabilities');
validatePublicIdentifierArray(manifest.public_safety_boundaries, 'agent-manifest.json.public_safety_boundaries');
assert(JSON.stringify(manifest.public_capabilities) === JSON.stringify(EXPECTED_PUBLIC_CAPABILITIES), 'Codex public capability declarations changed');
assert(JSON.stringify(manifest.public_safety_boundaries) === JSON.stringify(EXPECTED_PUBLIC_SAFETY_BOUNDARIES), 'Codex public safety-boundary declarations changed');

const protocolMap = new Map(manifest.supported_protocols.map((item) => [item.protocol_id, item]));
assert(protocolMap.size === manifest.supported_protocols.length, 'duplicate supported protocol ID');
const approvedRepositoryIds = declaredPublicRepositoryIds(manifest.supported_protocols, 'agent-manifest.json.supported_protocols');
const communications = protocolMap.get('nx-communications');
const sourcing = protocolMap.get('nx-sourcing-contract');
assert(communications?.version === VERSION && communications?.tag === TAG && communications?.repository_url === `https://github.com/${REPOSITORY}`, 'communications protocol reference mismatch');
assert(sourcing?.version === '0.1.0' && sourcing?.tag === 'contract-v0.1.0' && sourcing?.repository_url === 'https://github.com/normsexchange-dev/nx-sourcing-contracts_dev', 'immutable sourcing protocol reference mismatch');

for (const valid of ['role/leads/vietnam-rental-houses', 'role/directories/vietnam-film-directories', 'role/verification/company-records']) {
  assert(ROLE_BRANCH_PATTERN.test(valid), `documented valid role branch rejected: ${valid}`);
}
for (const invalid of ['roles/leads/example', 'role/Leads/example', 'role/leads', 'role/-leads/example', 'role/leads/example_1']) {
  assert(!ROLE_BRANCH_PATTERN.test(invalid), `invalid role branch accepted: ${invalid}`);
}

const roleManifest = parsedJson.get('role-manifest.json') || null;
const messagesByPath = new Map([...parsedJson].filter(([relativePath]) => MESSAGE_PATH_PATTERN.test(relativePath)));
validateDynamicState({
  branchName,
  relativeFiles,
  roleManifest,
  rolesIndex: parsedJson.get('roles/index.json'),
  messagesByPath,
  outboxIndex: parsedJson.get('outbox/index.json'),
  environmentId: manifest.environment_id
});

const agentSchema = parsedJson.get('schemas/agent-manifest.schema.json');
validateSchema(agentSchema, 'agent-manifest.schema.json', ['communications_version', 'environment_id', 'github_owner', 'communications_repository', 'environment_type', 'access_model', 'role_branch_grammar', 'supported_protocols', 'public_capabilities', 'public_safety_boundaries', 'bootstrap_document', 'status', 'updated_at']);
assert(agentSchema.properties.role_branch_grammar.const === ROLE_BRANCH_GRAMMAR, 'agent schema role grammar mismatch');
const environmentTypeSchema = agentSchema.properties.environment_type;
assert(environmentTypeSchema.type === 'string' && environmentTypeSchema.minLength === 1 && environmentTypeSchema.maxLength === 64, 'agent schema environment type must be bounded text');
assert(environmentTypeSchema.pattern === ENVIRONMENT_TYPE_PATTERN.source && !('const' in environmentTypeSchema) && !('enum' in environmentTypeSchema), 'agent schema environment type must be vendor-neutral');
for (const field of ['public_capabilities', 'public_safety_boundaries']) {
  const fieldSchema = agentSchema.properties[field];
  assert(fieldSchema.type === 'array' && fieldSchema.minItems === 1 && fieldSchema.uniqueItems === true, `agent schema ${field} must be nonempty and unique`);
  assert(fieldSchema.items?.type === 'string' && fieldSchema.items?.pattern === PUBLIC_IDENTIFIER_PATTERN.source, `agent schema ${field} item contract mismatch`);
}
const roleSchema = parsedJson.get('schemas/role-manifest.schema.json');
validateSchema(roleSchema, 'role-manifest.schema.json', ROLE_FIELDS);
assert(roleSchema.properties.data_classification.const === 'public_only', 'role data classification must be public_only');
assert(roleSchema.properties.bootstrap_version.const === VERSION && roleSchema.properties.communications_version.const === VERSION, 'role schema version mismatch');
assert(roleSchema.properties.prohibited_actions.minItems === PROHIBITED_ACTIONS.length, 'role schema must require every default prohibition');
const messageSchema = parsedJson.get('schemas/message-envelope.schema.json');
validateSchema(messageSchema, 'message-envelope.schema.json', MESSAGE_FIELDS);
assert(messageSchema.properties.protocol_version.const === VERSION, 'message protocol version mismatch');
assert(messageSchema.properties.role_branch.pattern === ROLE_BRANCH_GRAMMAR, 'message role branch grammar mismatch');
assert(messageSchema.properties.payload_classification.const === 'public_sanitized', 'message payload classification mismatch');
assert(Array.isArray(messageSchema.allOf) && messageSchema.allOf.length === 2, 'message schema must encode role and payload pairing');

const selfTestCount = runSelfTests();

const allText = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
validatePublicRepositoryReferences(allText, approvedRepositoryIds);
assert(!/[A-Za-z]:[\\/]Users[\\/]/.test(allText), 'local Windows user path found');
assert(!/(?:^|\s)\/(?:home|Users)\/[A-Za-z0-9._-]+\//m.test(allText), 'local POSIX user path found');
assert(!/(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|private[_-]?key)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{12,}/i.test(allText), 'credential-like value found');

const validatorSource = await readFile(fileURLToPath(import.meta.url), 'utf8');
const prohibitedCodeTokens = [
  ['node', ':http'].join(''),
  ['node', ':https'].join(''),
  ['f', 'etch('].join(''),
  ['Open', 'AI'].join(''),
  ['model', '.generate'].join('')
];
for (const token of prohibitedCodeTokens) assert(!validatorSource.includes(token), `validator contains prohibited network or model token: ${token}`);
for (const match of validatorSource.matchAll(/^import .* from ['"]([^'"]+)['"];$/gm)) assert(match[1].startsWith('node:'), `third-party import found: ${match[1]}`);

const messageCount = relativeFiles.filter((relativePath) => MESSAGE_PATH_PATTERN.test(relativePath)).length;
const roleCount = branch.kind === 'role' ? 1 : 0;
console.log(`validate-communications: PASS (${relativeFiles.length} files; ${jsonFiles.length} JSON; communications ${VERSION}; branch ${branchName}; roles ${roleCount}; messages ${messageCount}; self-tests ${selfTestCount})`);
