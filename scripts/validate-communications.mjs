import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTemplate } from './build-destination-core.mjs';
import { promptArtifacts } from './generate-prompts.mjs';
import {
  ADAPTABLE_MANIFEST_FIELDS,
  ALLOWED_DESTINATION_PATHS,
  GENERATED_PATHS,
  SOURCE_REPOSITORY,
  STATIC_PATHS,
  TAG,
  VALIDATOR_VERSION,
  VERSION,
  assert,
  findFiles,
  immutableManifest,
  readJson,
  sha256,
  stableStringify
} from './lib/destination-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_FILES = [
  '.github/workflows/validate-communications.yml', '.gitignore', 'agent-manifest.json', 'AUTOSTART.md',
  'BOOTSTRAP_STATUS_dev.md', 'bootstrap/AGENT_BOOTSTRAP_dev.md', 'CHANGELOG.md', 'COMMUNICATIONS_VERSION',
  'destination-core-template.json', 'docs/MESSAGE_PROTOCOL_dev.md', 'docs/RECOVERY_PROTOCOL_dev.md',
  'docs/ROLE_BRANCH_PROTOCOL_dev.md', 'docs/SECURITY_BOUNDARY_dev.md', 'mission/NORMS_EXCHANGE_MISSION.md',
  'mission/norms-exchange-mission.json', 'outbox/index.json',
  'prompts/codex-independent-verification.txt', 'prompts/emergency-stop-revoke-access.txt',
  'prompts/gemini-emergency-containment.txt', 'prompts/gemini-fresh-install.txt',
  'prompts/gemini-recovery-clean-reinstall.txt', 'prompts/gemini-wtb-role-activation.txt',
  'README.md', 'release/previous-tags.json', 'roles/index.json',
  'schemas/agent-manifest.schema.json', 'schemas/attestation.schema.json', 'schemas/destination-core.schema.json',
  'schemas/message-envelope.schema.json', 'schemas/mission.schema.json', 'schemas/role-manifest.schema.json',
  'scripts/build-destination-core.mjs', 'scripts/generate-prompts.mjs', 'scripts/lib/destination-core.mjs',
  'scripts/materialize-destination.mjs', 'scripts/test-communications.mjs', 'scripts/validate-communications.mjs',
  'scripts/validate-destination.mjs', 'scripts/verify-public-destination.mjs',
  'tests/destination-bootstrap-regressions.json', 'tests/fixtures/captured-gemini-71e27ad-tree.json'
].sort();
const KNOWN_CREDENTIAL_PATTERN = /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{35,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
const ALLOWED_PUBLIC_REPOSITORIES = new Set([SOURCE_REPOSITORY, 'normsexchange-dev/nx-sourcing-contracts_dev']);
const EXPECTED_REGRESSIONS = [
  'clean_generated_destination_passes', 'materialization_idempotent', 'wrong_authenticated_owner_fails',
  'mutable_main_url_fails', 'lightweight_or_wrong_tag_fails', 'missing_workflow_fails',
  'missing_workflow_run_fails', 'missing_or_altered_mission_fails', 'extra_arbitrary_file_fails',
  'package_server_src_data_env_agents_evolution_fail', 'github_token_localstorage_fails',
  'autonomous_github_push_fails', 'self_replication_or_authority_fails',
  'fabricated_candidate_database_fails', 'stale_v02_manifest_fails', 'role_during_bootstrap_fails',
  'captured_gemini_destination_fails', 'clean_synthetic_public_verification_passes',
  'credential_scan_emits_no_values', 'fresh_clone_annotated_tag_passes', 'previous_tags_unchanged'
];

function git(args) {
  return execFileSync(process.env.GIT_EXECUTABLE || 'git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function parseBranch(argv) {
  const index = argv.indexOf('--branch');
  assert(index >= 0 && index + 1 < argv.length && argv.length === 2, 'branch_argument_required');
  const branch = argv[index + 1];
  assert(branch === 'main' || /^agent\/[A-Za-z0-9_]+\/[a-z0-9-]+$/.test(branch), 'source_branch_invalid');
  return branch;
}

function validateSourceManifest(manifest) {
  assert(manifest.communications_version === VERSION && manifest.protocol_role === 'source', 'source_manifest_version_or_role_mismatch');
  assert(stableStringify(manifest.protocol_source) === stableStringify({ repository: SOURCE_REPOSITORY, version: VERSION, tag: TAG }), 'source_manifest_release_identity_mismatch');
  assert(manifest.environment_id === 'normsexchange-codex' && manifest.github_owner === 'normsexchange-dev' && manifest.communications_repository === SOURCE_REPOSITORY, 'source_manifest_owner_identity_mismatch');
  assert(manifest.environment_type === 'Codex' && manifest.status === 'ready', 'source_manifest_runtime_or_status_mismatch');
  const communications = manifest.supported_protocols.find((entry) => entry.protocol_id === 'nx-communications');
  const contract = manifest.supported_protocols.find((entry) => entry.protocol_id === 'nx-sourcing-contract');
  assert(stableStringify(communications) === stableStringify({ protocol_id: 'nx-communications', version: VERSION, tag: TAG, repository_url: `https://github.com/${SOURCE_REPOSITORY}` }), 'source_manifest_communications_reference_mismatch');
  assert(stableStringify(contract) === stableStringify({ protocol_id: 'nx-sourcing-contract', version: '0.2.0', tag: 'contract-v0.2.0', repository_url: 'https://github.com/normsexchange-dev/nx-sourcing-contracts_dev' }), 'source_manifest_contract_reference_mismatch');
}

async function validateSchemas() {
  for (const name of ['agent-manifest.schema.json', 'attestation.schema.json', 'destination-core.schema.json', 'message-envelope.schema.json', 'mission.schema.json', 'role-manifest.schema.json']) {
    const schema = await readJson(path.join(root, 'schemas', name));
    assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', `schema_draft_invalid:${name}`);
    assert(schema.$id === `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/${TAG}/schemas/${name}`, `schema_release_identity_invalid:${name}`);
    assert(schema.type === 'object' && schema.additionalProperties === false, `schema_not_restrictive:${name}`);
  }
}

async function validatePreviousTags() {
  const release = await readJson(path.join(root, 'release/previous-tags.json'));
  assert(release.schema_version === '1.0.0' && Array.isArray(release.tags) && release.tags.length === 5, 'previous_tag_catalog_invalid');
  for (const entry of release.tags) {
    assert(git(['rev-parse', `refs/tags/${entry.tag}`]) === entry.object, `previous_tag_object_changed:${entry.tag}`);
    assert(git(['cat-file', '-t', `refs/tags/${entry.tag}`]) === entry.type, `previous_tag_type_changed:${entry.tag}`);
    assert(git(['rev-list', '-n', '1', `refs/tags/${entry.tag}`]) === entry.target, `previous_tag_target_changed:${entry.tag}`);
  }
}

const branch = parseBranch(process.argv.slice(2));
const files = await findFiles(root);
const relativeFiles = files.map((file) => path.relative(root, file).split(path.sep).join('/')).sort();
assert(stableStringify(relativeFiles) === stableStringify(SOURCE_FILES), 'source_tree_not_exact');
assert((await readFile(path.join(root, 'COMMUNICATIONS_VERSION'), 'utf8')).trim() === VERSION, 'communications_version_file_mismatch');

const manifest = await readJson(path.join(root, 'agent-manifest.json'));
validateSourceManifest(manifest);
assert(stableStringify(await readJson(path.join(root, 'roles/index.json'))) === stableStringify({ communications_version: VERSION, roles: [] }), 'source_role_index_not_empty');
assert(stableStringify(await readJson(path.join(root, 'outbox/index.json'))) === stableStringify({ communications_version: VERSION, messages: [] }), 'source_outbox_not_empty');
assert(sha256(await readFile(path.join(root, 'mission/NORMS_EXCHANGE_MISSION.md'))) === '9a61610f46cacb9930f82489d4b9ff789ebc074995fa6e7ac2da89812bbeb458', 'human_mission_changed');
assert(sha256(await readFile(path.join(root, 'mission/norms-exchange-mission.json'))) === '0f86eac9bbdabe7d31981206125efe311d36cd4873a2ace13f531cbd8769ffbb', 'machine_mission_changed');
await validateSchemas();

const actualTemplate = await readJson(path.join(root, 'destination-core-template.json'));
const expectedTemplate = await buildTemplate(root);
assert(stableStringify(actualTemplate) === stableStringify(expectedTemplate), 'destination_core_template_stale');
assert(stableStringify(actualTemplate.destination.allowed_paths) === stableStringify(ALLOWED_DESTINATION_PATHS), 'destination_allowed_paths_invalid');
assert(stableStringify(actualTemplate.destination.static_files.map((entry) => entry.path)) === stableStringify(STATIC_PATHS), 'destination_static_paths_invalid');
assert(stableStringify(actualTemplate.destination.generated_paths) === stableStringify(GENERATED_PATHS), 'destination_generated_paths_invalid');
assert(stableStringify(actualTemplate.destination.adaptable_manifest_fields) === stableStringify(ADAPTABLE_MANIFEST_FIELDS), 'destination_adaptable_fields_invalid');
assert(stableStringify(actualTemplate.destination.immutable_manifest) === stableStringify(immutableManifest(manifest)), 'destination_immutable_manifest_invalid');

for (const [name, expected] of promptArtifacts()) assert(await readFile(path.join(root, 'prompts', name), 'utf8') === expected, `prompt_artifact_stale:${name}`);
const regressions = await readJson(path.join(root, 'tests/destination-bootstrap-regressions.json'));
assert(regressions.communications_version === VERSION && regressions.fixture_model === 'deterministic_external_bootstrap_security', 'regression_catalog_identity_invalid');
assert(stableStringify(regressions.cases.map((entry) => entry.case_id)) === stableStringify(EXPECTED_REGRESSIONS), 'regression_catalog_coverage_invalid');
for (const entry of regressions.cases) assert(entry.expected === (entry.case_id.includes('passes') || entry.case_id.includes('idempotent') || entry.case_id.includes('unchanged') ? 'pass' : 'reject'), `regression_expectation_invalid:${entry.case_id}`);

const readme = await readFile(path.join(root, 'README.md'), 'utf8');
const freshPrompt = `Initialize NX environment <requested-environment> from https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/${TAG}/AUTOSTART.md`;
assert(readme.split(freshPrompt).length - 1 === 1, 'canonical_fresh_install_prompt_count_invalid');
const autostart = (await readFile(path.join(root, 'AUTOSTART.md'), 'utf8')).toLowerCase();
for (const phrase of ['annotated tag target', 'before any mutation', 'exactly equal the requested environment', 'adapt only the seven authorized manifest fields', 'roles/index.json` empty', 'missing, unavailable, unrun, failed, or unverifiable validation is no-go', 'stop before substantive role work', 'ready as advisory']) assert(autostart.includes(phrase), `autostart_instruction_missing:${phrase}`);
const recovery = (await readFile(path.join(root, 'docs/RECOVERY_PROTOCOL_dev.md'), 'utf8')).toLowerCase();
for (const phrase of ['stop any deployed application', 'revoke every pat or token', 'remove applicable deployment secrets', 'clear browser localstorage', 'quarantine name', 'make the quarantine repository private', 'preserve it for audit', 'brand-new empty public repository', 'copy no old application files', 'stop before substantive role work']) assert(recovery.includes(phrase), `recovery_instruction_missing:${phrase}`);

const workflow = await readFile(path.join(root, '.github/workflows/validate-communications.yml'), 'utf8');
assert(/permissions:\s*\r?\n\s+contents:\s*read/.test(workflow) && !/contents:\s*write/.test(workflow), 'workflow_permissions_not_read_only');
assert(workflow.includes('fetch-depth: 0') && workflow.includes('validate-destination.mjs') && workflow.includes('test-communications.mjs'), 'workflow_validation_steps_missing');
assert(!/\bsecrets\./.test(workflow), 'workflow_must_not_use_secrets');

const textFiles = await Promise.all(files.map(async (file) => ({ file, text: await readFile(file, 'utf8') })));
for (const { file, text } of textFiles) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  for (const match of text.matchAll(/normsexchange-dev\/[A-Za-z0-9._-]+/gi)) {
    assert(ALLOWED_PUBLIC_REPOSITORIES.has(match[0]), `unapproved_repository_identity_found:${relative}`);
  }
  assert(!KNOWN_CREDENTIAL_PATTERN.test(text), `credential_value_signature_found:${relative}`);
  assert(!/[A-Za-z]:[\\/]Users[\\/]/.test(text) && !/(?:^|\s)\/(?:home|Users)\/[A-Za-z0-9._-]+\//m.test(text), `private_local_path_found:${relative}`);
  if (relative.endsWith('.mjs')) {
    for (const match of text.matchAll(/^import .* from ['"]([^'"]+)['"];$/gm)) assert(match[1].startsWith('node:') || match[1].startsWith('.'), `third_party_import_found:${relative}`);
    for (const token of [['Open', 'AI'].join(''), ['model', '.generate'].join(''), ['generate', 'Content('].join('')]) assert(!text.includes(token), `model_call_token_found:${relative}`);
  }
}

await validatePreviousTags();
console.log(`validate-communications: PASS (${relativeFiles.length} source files; ${ALLOWED_DESTINATION_PATHS.length} destination paths; ${STATIC_PATHS.length} static hashes; ${ADAPTABLE_MANIFEST_FIELDS.length} adaptations; ${regressions.cases.length} regressions; communications ${VERSION}; branch ${branch}; validator ${VALIDATOR_VERSION})`);
