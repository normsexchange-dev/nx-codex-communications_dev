import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADAPTABLE_MANIFEST_FIELDS,
  ALLOWED_DESTINATION_PATHS,
  GENERATED_PATHS,
  MISSION_ACKNOWLEDGMENT_ID,
  MISSION_ACKNOWLEDGMENT_PATH,
  MISSION_ACKNOWLEDGMENT_SUMMARY,
  SOURCE_REPOSITORY,
  STATIC_PATHS,
  TAG,
  VALIDATOR_VERSION,
  VERSION,
  assert,
  computeCoreDigest,
  expectedDestinationRepository,
  immutableManifest,
  readCanonicalStatic,
  readJson,
  sha256,
  stableStringify,
  validateDestination
} from './lib/destination-core.mjs';

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMMUTABLE_AUTOSTART_URL = `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/${TAG}/AUTOSTART.md`;

function git(root, args) {
  return execFileSync(process.env.GIT_EXECUTABLE || 'git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function validateInstallRequest({ environment, authenticatedOwner, sourceUrl }) {
  assert(authenticatedOwner === environment, 'authenticated_owner_mismatch');
  assert(sourceUrl === IMMUTABLE_AUTOSTART_URL, 'immutable_autostart_url_required');
  assert(!sourceUrl.includes('/main/'), 'mutable_source_url_rejected');
  return expectedDestinationRepository(environment);
}

export function resolveReleaseIdentity(sourceRoot) {
  let tagObject;
  let tagTarget;
  try {
    tagObject = git(sourceRoot, ['rev-parse', `refs/tags/${TAG}^{tag}`]);
    tagTarget = git(sourceRoot, ['rev-parse', `refs/tags/${TAG}^{}`]);
  } catch {
    throw new Error('annotated_release_tag_required');
  }
  assert(git(sourceRoot, ['cat-file', '-t', tagObject]) === 'tag', 'lightweight_release_tag_rejected');
  assert(git(sourceRoot, ['cat-file', '-t', tagTarget]) === 'commit', 'release_target_must_be_commit');
  assert(git(sourceRoot, ['rev-parse', 'HEAD']) === tagTarget, 'source_checkout_must_equal_release_target');
  return { tagObject, tagTarget };
}

function pretty(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function verifySourceTemplate(sourceRoot, template, sourceManifest) {
  assert(template.schema_version === '1.0.0' && template.validator_version === VALIDATOR_VERSION, 'source_template_version_mismatch');
  assert(stableStringify(template.source) === stableStringify({ repository: SOURCE_REPOSITORY, release: TAG, tag_ref: `refs/tags/${TAG}`, tag_object_type: 'tag', tag_target_type: 'commit' }), 'source_template_release_identity_mismatch');
  assert(stableStringify(template.destination.allowed_paths) === stableStringify(ALLOWED_DESTINATION_PATHS), 'source_template_allowed_paths_mismatch');
  assert(stableStringify(template.destination.generated_paths) === stableStringify(GENERATED_PATHS), 'source_template_generated_paths_mismatch');
  assert(stableStringify(template.destination.adaptable_manifest_fields) === stableStringify(ADAPTABLE_MANIFEST_FIELDS), 'source_template_adaptable_fields_mismatch');
  assert(stableStringify(template.destination.immutable_manifest) === stableStringify(immutableManifest(sourceManifest)), 'source_template_manifest_baseline_mismatch');
  assert(stableStringify(template.destination.static_files.map((entry) => entry.path)) === stableStringify(STATIC_PATHS), 'source_template_static_paths_mismatch');
  for (const entry of template.destination.static_files) {
    const actual = sha256(await readCanonicalStatic(sourceRoot, entry.path));
    assert(actual === entry.sha256, `source_template_static_hash_mismatch:${entry.path}`);
  }
}

async function directoryHasEntries(directory) {
  try { return (await readdir(directory)).length > 0; } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function materializeDestination(options) {
  const sourceRoot = path.resolve(options.sourceRoot || moduleRoot);
  const outputRoot = path.resolve(options.output);
  assert(outputRoot !== sourceRoot && !outputRoot.startsWith(`${sourceRoot}${path.sep}`), 'destination_must_be_outside_source_checkout');
  assert(typeof options.runtime === 'string' && options.runtime.trim().length >= 1 && options.runtime.length <= 64, 'runtime_type_invalid');
  assert(typeof options.updatedAt === 'string' && Number.isFinite(Date.parse(options.updatedAt)), 'updated_at_required');
  const expectedRepository = validateInstallRequest({ environment: options.environment, authenticatedOwner: options.authenticatedOwner, sourceUrl: options.sourceUrl });
  assert(options.owner === options.environment && options.repository === expectedRepository, 'destination_identity_mismatch');

  if (await directoryHasEntries(outputRoot)) {
    const existing = await validateDestination(outputRoot, {
      expectedRepository: options.repository,
      expectedEnvironment: options.environment,
      expectedOwner: options.owner,
      expectedRuntime: options.runtime
    }).catch(() => null);
    assert(existing, 'refusing_nonempty_incomplete_or_contaminated_destination');
    return { ...existing, destination_status: existing.status, status: 'UNCHANGED' };
  }

  const { tagObject, tagTarget } = resolveReleaseIdentity(sourceRoot);
  const template = await readJson(path.join(sourceRoot, 'destination-core-template.json'));
  const sourceManifest = await readJson(path.join(sourceRoot, 'agent-manifest.json'));
  await verifySourceTemplate(sourceRoot, template, sourceManifest);

  await mkdir(outputRoot, { recursive: true });
  for (const relativePath of STATIC_PATHS) {
    const destination = path.join(outputRoot, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, await readCanonicalStatic(sourceRoot, relativePath));
  }

  const destinationManifest = structuredClone(sourceManifest);
  Object.assign(destinationManifest, {
    protocol_role: 'destination',
    environment_id: options.environment,
    github_owner: options.owner,
    communications_repository: options.repository,
    environment_type: options.runtime,
    status: 'initializing',
    updated_at: options.updatedAt
  });

  const acknowledgment = {
    protocol_version: VERSION,
    message_id: MISSION_ACKNOWLEDGMENT_ID,
    sender_environment: options.environment,
    recipient_environment: 'normsexchange-codex',
    message_type: 'acknowledgment',
    role_id: null,
    role_branch: null,
    created_at: options.updatedAt,
    in_reply_to: null,
    supported_contract_version: null,
    public_summary: MISSION_ACKNOWLEDGMENT_SUMMARY,
    payload_classification: 'public_sanitized',
    payload_reference: null,
    payload_sha256: null,
    supersedes_message_id: null,
    status: 'published'
  };
  const outbox = {
    communications_version: VERSION,
    messages: [{ message_id: acknowledgment.message_id, path: MISSION_ACKNOWLEDGMENT_PATH, created_at: acknowledgment.created_at, status: acknowledgment.status }]
  };
  const core = {
    schema_version: '1.0.0',
    validator_version: VALIDATOR_VERSION,
    source: {
      ...template.source,
      tag_object_sha: tagObject,
      tag_target_sha: tagTarget
    },
    destination: {
      ...template.destination,
      core_digest: ''
    }
  };
  core.destination.core_digest = computeCoreDigest(core);

  const generated = new Map([
    ['agent-manifest.json', destinationManifest],
    ['destination-core.json', core],
    ['outbox/index.json', outbox],
    [MISSION_ACKNOWLEDGMENT_PATH, acknowledgment]
  ]);
  for (const [relativePath, value] of generated) {
    const destination = path.join(outputRoot, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, pretty(value), 'utf8');
  }

  const validated = await validateDestination(outputRoot, {
    expectedRepository: options.repository,
    expectedEnvironment: options.environment,
    expectedOwner: options.owner,
    expectedRuntime: options.runtime
  });
  return { ...validated, destination_status: validated.status, status: 'CREATED' };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--') || index + 1 >= argv.length) throw new Error('invalid_arguments');
    options[key.slice(2)] = argv[++index];
  }
  for (const required of ['environment', 'authenticated-owner', 'owner', 'repository', 'runtime', 'output', 'updated-at']) assert(options[required], `missing_argument:${required}`);
  return {
    sourceRoot: options['source-root'] || moduleRoot,
    sourceUrl: options['source-url'] || IMMUTABLE_AUTOSTART_URL,
    environment: options.environment,
    authenticatedOwner: options['authenticated-owner'],
    owner: options.owner,
    repository: options.repository,
    runtime: options.runtime,
    output: options.output,
    updatedAt: options['updated-at']
  };
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await materializeDestination(parseArguments(process.argv.slice(2)))));
  } catch (error) {
    console.error(JSON.stringify({ result: 'NO-GO', finding: String(error.message || 'materialization_failed').replace(/[^A-Za-z0-9_:\/.-]/g, '_').slice(0, 240) }));
    process.exitCode = 1;
  }
}
