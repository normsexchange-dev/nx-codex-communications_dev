import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '0.1.0';
const TAG = `communications-v${VERSION}`;
const DRAFT = 'https://json-schema.org/draft/2020-12/schema';
const REPOSITORY = 'normsexchange-dev/nx-codex-communications_dev';
const TAGGED_SCHEMA_ROOT = `https://raw.githubusercontent.com/${REPOSITORY}/${TAG}/schemas`;
const ROLE_BRANCH_GRAMMAR = '^role/[a-z0-9]+(?:-[a-z0-9]+)*/[a-z0-9]+(?:-[a-z0-9]+)*$';
const ROLE_BRANCH_PATTERN = new RegExp(ROLE_BRANCH_GRAMMAR);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EXPECTED_FILES = [
  '.github/workflows/validate-communications.yml', '.gitignore', 'COMMUNICATIONS_VERSION', 'README.md',
  'agent-manifest.json', 'bootstrap/AGENT_BOOTSTRAP_dev.md', 'docs/MESSAGE_PROTOCOL_dev.md',
  'docs/ROLE_BRANCH_PROTOCOL_dev.md', 'docs/SECURITY_BOUNDARY_dev.md', 'outbox/index.json',
  'roles/index.json', 'schemas/agent-manifest.schema.json', 'schemas/message-envelope.schema.json',
  'schemas/role-manifest.schema.json', 'scripts/validate-communications.mjs'
].sort();

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

function exactKeys(value, keys, label) {
  assert(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${label}: unexpected fields`);
}

function validateSchema(schema, name, required) {
  assert(schema.$schema === DRAFT, `${name}: must use Draft 2020-12`);
  assert(schema.$id === `${TAGGED_SCHEMA_ROOT}/${name}`, `${name}: immutable schema identity mismatch`);
  assert(schema.type === 'object' && schema.additionalProperties === false, `${name}: restrictive object root required`);
  assert(Array.isArray(schema.required), `${name}: required array missing`);
  for (const field of required) assert(schema.required.includes(field), `${name}: required field missing: ${field}`);
}

const files = await findFiles();
const relativeFiles = files.map((file) => path.relative(root, file).split(path.sep).join('/')).sort();
assert(JSON.stringify(relativeFiles) === JSON.stringify(EXPECTED_FILES), 'repository file set differs from the bounded 15-file contract');

const jsonFiles = relativeFiles.filter((file) => file.endsWith('.json'));
for (const file of jsonFiles) await json(file);

assert((await readFile(path.join(root, 'COMMUNICATIONS_VERSION'), 'utf8')).trim() === VERSION, 'communications version mismatch');

const manifest = await json('agent-manifest.json');
exactKeys(manifest, ['$schema', 'communications_version', 'environment_id', 'github_owner', 'communications_repository', 'environment_type', 'access_model', 'role_branch_grammar', 'supported_protocols', 'public_capabilities', 'public_safety_boundaries', 'bootstrap_document', 'status', 'updated_at'], 'agent-manifest.json');
assert(manifest.$schema === './schemas/agent-manifest.schema.json', 'agent manifest schema reference mismatch');
assert(manifest.communications_version === VERSION, 'agent manifest version mismatch');
assert(manifest.environment_id === 'normsexchange-codex', 'environment identifier mismatch');
assert(manifest.github_owner === 'normsexchange-dev', 'GitHub owner mismatch');
assert(manifest.communications_repository === REPOSITORY, 'communications repository mismatch');
assert(manifest.environment_type === 'Codex', 'environment type mismatch');
assert(manifest.access_model.public_read === true && manifest.access_model.owner_write_only === true && manifest.access_model.external_write === false, 'owner-write/public-read access model mismatch');
assert(manifest.role_branch_grammar === ROLE_BRANCH_GRAMMAR, 'role branch grammar mismatch');
assert(manifest.bootstrap_document === 'bootstrap/AGENT_BOOTSTRAP_dev.md', 'bootstrap document mismatch');
assert(manifest.status === 'ready' && Number.isFinite(Date.parse(manifest.updated_at)), 'environment status or timestamp invalid');

const protocolMap = new Map(manifest.supported_protocols.map((item) => [item.protocol_id, item]));
assert(protocolMap.size === manifest.supported_protocols.length, 'duplicate supported protocol ID');
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

const roles = await json('roles/index.json');
exactKeys(roles, ['communications_version', 'roles'], 'roles/index.json');
assert(roles.communications_version === VERSION && Array.isArray(roles.roles) && roles.roles.length === 0, 'role index must be empty');
const outbox = await json('outbox/index.json');
exactKeys(outbox, ['communications_version', 'messages'], 'outbox/index.json');
assert(outbox.communications_version === VERSION && Array.isArray(outbox.messages) && outbox.messages.length === 0, 'outbox index must be empty');

const agentSchema = await json('schemas/agent-manifest.schema.json');
validateSchema(agentSchema, 'agent-manifest.schema.json', ['communications_version', 'environment_id', 'github_owner', 'communications_repository', 'environment_type', 'access_model', 'role_branch_grammar', 'supported_protocols', 'bootstrap_document', 'status', 'updated_at']);
assert(agentSchema.properties.role_branch_grammar.const === ROLE_BRANCH_GRAMMAR, 'agent schema role grammar mismatch');
const roleSchema = await json('schemas/role-manifest.schema.json');
validateSchema(roleSchema, 'role-manifest.schema.json', ['role_id', 'role_name', 'purpose', 'goal', 'originating_environment', 'bootstrap_version', 'communications_version', 'allowed_inputs', 'expected_outputs', 'data_classification', 'allowed_actions', 'prohibited_actions', 'supported_protocol_versions', 'created_at', 'status']);
assert(roleSchema.properties.data_classification.const === 'public_only', 'role data classification must be public_only');
assert(roleSchema.properties.communications_version.const === VERSION, 'role schema version mismatch');
const messageSchema = await json('schemas/message-envelope.schema.json');
validateSchema(messageSchema, 'message-envelope.schema.json', ['protocol_version', 'message_id', 'sender_environment', 'recipient_environment', 'message_type', 'role_id', 'role_branch', 'created_at', 'in_reply_to', 'supported_contract_version', 'public_summary', 'payload_classification', 'payload_reference', 'payload_sha256', 'supersedes_message_id', 'status']);
assert(messageSchema.properties.protocol_version.const === VERSION, 'message protocol version mismatch');
assert(messageSchema.properties.role_branch.pattern === ROLE_BRANCH_GRAMMAR, 'message role branch grammar mismatch');
assert(messageSchema.properties.payload_classification.const === 'public_sanitized', 'message payload classification mismatch');

const allText = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
const privateRepositoryNames = [
  ['ai', 'agent', 'control'].join('-'),
  ['ai', 'agent', 'ops'].join('-'),
  ['norms', 'exchange', 'theme_dev'].join('-')
];
for (const name of privateRepositoryNames) assert(!allText.includes(name), `private repository name found: ${name}`);
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

console.log(`validate-communications: PASS (${relativeFiles.length} files; ${jsonFiles.length} JSON; communications ${VERSION}; roles 0; messages 0)`);
