import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { materializeDestination, resolveReleaseIdentity, validateInstallRequest } from './materialize-destination.mjs';
import { verifyPreparedDestination } from './verify-public-destination.mjs';
import { MISSION_ACKNOWLEDGMENT_ID, SOURCE_REPOSITORY, TAG, readJson, validateDestination } from './lib/destination-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gitExecutable = process.env.GIT_EXECUTABLE || 'git';
const immutableUrl = `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/${TAG}/AUTOSTART.md`;
let passed = 0;

function git(directory, args) {
  return execFileSync(gitExecutable, ['-C', directory, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

async function expectReject(label, callback, valueThatMustNotAppear = null) {
  let error = null;
  try { await callback(); } catch (caught) { error = caught; }
  if (!error) throw new Error(`expected rejection: ${label}`);
  if (valueThatMustNotAppear && String(error.message).includes(valueThatMustNotAppear)) throw new Error(`credential value leaked by rejection: ${label}`);
  passed += 1;
}

function pass(condition, label) {
  if (!condition) throw new Error(`expected pass: ${label}`);
  passed += 1;
}

async function writePath(directory, relativePath, content) {
  const target = path.join(directory, ...relativePath.split('/'));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
}

async function copyDestination(clean, tempRoot, name) {
  const destination = path.join(tempRoot, name);
  await cp(clean, destination, { recursive: true });
  return destination;
}

async function initializeTaggedSource(tempRoot) {
  const source = path.join(tempRoot, 'tagged-source');
  await cp(root, source, { recursive: true, filter: (sourcePath) => path.basename(sourcePath) !== '.git' && path.basename(sourcePath) !== 'node_modules' });
  git(source, ['init', '--initial-branch=main']);
  git(source, ['config', 'user.name', 'NX Protocol Tests']);
  git(source, ['config', 'user.email', 'protocol-tests@users.noreply.github.com']);
  git(source, ['add', '.']);
  git(source, ['commit', '-m', 'Synthetic immutable source fixture']);
  git(source, ['tag', '-a', TAG, '-m', 'Synthetic annotated release fixture']);
  resolveReleaseIdentity(source);
  return source;
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'nx-communications-tests-'));
try {
  const taggedSource = await initializeTaggedSource(tempRoot);
  const clean = path.join(tempRoot, 'clean-destination');
  const options = {
    sourceRoot: taggedSource,
    sourceUrl: immutableUrl,
    environment: 'normsexchange-example',
    authenticatedOwner: 'normsexchange-example',
    owner: 'normsexchange-example',
    repository: 'normsexchange-example/nx-example-communications_dev',
    runtime: 'Example Runtime',
    output: clean,
    updatedAt: '2026-08-26T00:00:00Z'
  };
  const created = await materializeDestination(options);
  pass(created.status === 'CREATED' && (await validateDestination(clean)).result === 'GO', 'clean_generated_destination_passes');
  const unchanged = await materializeDestination(options);
  pass(unchanged.status === 'UNCHANGED', 'materialization_idempotent');

  await expectReject('wrong_authenticated_owner_fails', () => materializeDestination({ ...options, output: path.join(tempRoot, 'wrong-owner'), authenticatedOwner: 'different-owner' }));
  await expectReject('mutable_main_url_fails', async () => validateInstallRequest({ environment: options.environment, authenticatedOwner: options.authenticatedOwner, sourceUrl: `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/main/AUTOSTART.md` }));

  const lightweight = path.join(tempRoot, 'lightweight-source');
  await cp(taggedSource, lightweight, { recursive: true });
  git(lightweight, ['tag', '-d', TAG]);
  git(lightweight, ['tag', TAG, 'HEAD']);
  await expectReject('lightweight_or_wrong_tag_fails', async () => resolveReleaseIdentity(lightweight));

  const missingWorkflow = await copyDestination(clean, tempRoot, 'missing-workflow');
  await rm(path.join(missingWorkflow, '.github/workflows/validate-communications.yml'));
  await expectReject('missing_workflow_fails', () => validateDestination(missingWorkflow));

  const alteredMission = await copyDestination(clean, tempRoot, 'altered-mission');
  await writeFile(path.join(alteredMission, 'mission/NORMS_EXCHANGE_MISSION.md'), 'altered mission\n', 'utf8');
  await expectReject('missing_or_altered_mission_fails', () => validateDestination(alteredMission));

  const extraFile = await copyDestination(clean, tempRoot, 'extra-file');
  await writePath(extraFile, 'arbitrary.txt', 'fixture only\n');
  await expectReject('extra_arbitrary_file_fails', () => validateDestination(extraFile));

  for (const prohibited of ['package.json', 'server.ts', 'src/app.ts', 'data/records.json', '.env', 'AGENTS.md', 'EVOLUTION.md']) {
    const destination = await copyDestination(clean, tempRoot, `path-${prohibited.replace(/[^a-z]/gi, '-')}`);
    await writePath(destination, prohibited, '{}\n');
    await expectReject(`prohibited_path:${prohibited}`, () => validateDestination(destination));
  }

  const tokenStorage = await copyDestination(clean, tempRoot, 'token-storage');
  await writePath(tokenStorage, 'extension.js', ['local', 'Storage.setItem("github_token", "fixture")'].join(''));
  await expectReject('github_token_localstorage_fails', () => validateDestination(tokenStorage));

  const githubPush = await copyDestination(clean, tempRoot, 'github-push');
  await writePath(githubPush, 'sync.js', ['const command = "git', ' push";'].join(''));
  await expectReject('autonomous_github_push_fails', () => validateDestination(githubPush));

  const selfAuthority = await copyDestination(clean, tempRoot, 'self-authority');
  await writePath(selfAuthority, 'authority.txt', ['self-', 'replicate and expand authority'].join(''));
  await expectReject('self_replication_or_authority_fails', () => validateDestination(selfAuthority));

  const fabricated = await copyDestination(clean, tempRoot, 'fabricated-records');
  await writePath(fabricated, 'records.json', '{"candidate":"fixture","verified":true,"price":100}\n');
  await expectReject('fabricated_candidate_database_fails', () => validateDestination(fabricated));

  const staleManifest = await copyDestination(clean, tempRoot, 'stale-manifest');
  const stale = await readJson(path.join(staleManifest, 'agent-manifest.json'));
  stale.communications_version = '0.2.0';
  await writeFile(path.join(staleManifest, 'agent-manifest.json'), `${JSON.stringify(stale, null, 2)}\n`, 'utf8');
  await expectReject('stale_v02_manifest_fails', () => validateDestination(staleManifest));

  const roleCreated = await copyDestination(clean, tempRoot, 'role-created');
  await writePath(roleCreated, 'role-manifest.json', '{}\n');
  await expectReject('role_during_bootstrap_fails', () => validateDestination(roleCreated));

  const capturedFixture = await readJson(path.join(root, 'tests/fixtures/captured-gemini-71e27ad-tree.json'));
  const captured = path.join(tempRoot, 'captured-gemini');
  for (const observedPath of capturedFixture.sanitized_observed_paths) await writePath(captured, observedPath, 'sanitized fixture marker\n');
  await expectReject('captured_gemini_destination_fails', () => verifyPreparedDestination({
    root: captured,
    repository: capturedFixture.repository,
    destinationCommit: capturedFixture.commit,
    initializingCommit: '1'.repeat(40),
    readyCommit: capturedFixture.commit,
    sourceTagObject: '2'.repeat(40),
    sourceTagTarget: '3'.repeat(40),
    workflowRuns: [{ commit: '1'.repeat(40), run_id: 1, conclusion: 'success' }, { commit: capturedFixture.commit, run_id: 2, conclusion: 'success' }]
  }));

  const ready = await copyDestination(clean, tempRoot, 'ready-destination');
  const readyManifest = await readJson(path.join(ready, 'agent-manifest.json'));
  readyManifest.status = 'ready';
  readyManifest.updated_at = '2026-08-26T00:01:00Z';
  await writeFile(path.join(ready, 'agent-manifest.json'), `${JSON.stringify(readyManifest, null, 2)}\n`, 'utf8');
  const core = await readJson(path.join(ready, 'destination-core.json'));
  const initializingCommit = '1'.repeat(40);
  const readyCommit = '2'.repeat(40);
  const attestation = await verifyPreparedDestination({
    root: ready,
    repository: options.repository,
    destinationCommit: readyCommit,
    initializingCommit,
    readyCommit,
    sourceTagObject: core.source.tag_object_sha,
    sourceTagTarget: core.source.tag_target_sha,
    workflowRuns: [{ commit: initializingCommit, run_id: 1001, conclusion: 'success' }, { commit: readyCommit, run_id: 1002, conclusion: 'success' }],
    missionAcknowledgmentId: MISSION_ACKNOWLEDGMENT_ID
  });
  pass(attestation.result === 'GO', 'clean_synthetic_public_verification_passes');
  await expectReject('missing_workflow_run_fails', () => verifyPreparedDestination({
    root: ready,
    repository: options.repository,
    destinationCommit: readyCommit,
    initializingCommit,
    readyCommit,
    sourceTagObject: core.source.tag_object_sha,
    sourceTagTarget: core.source.tag_target_sha,
    workflowRuns: [{ commit: readyCommit, run_id: 1002, conclusion: 'success' }],
    missionAcknowledgmentId: MISSION_ACKNOWLEDGMENT_ID
  }));

  const credential = ['gh', 'p_', 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8'].join('');
  const credentialDestination = await copyDestination(clean, tempRoot, 'credential-value');
  await writePath(credentialDestination, 'credential.txt', credential);
  await expectReject('credential_scan_emits_no_values', () => validateDestination(credentialDestination), credential);

  pass(resolveReleaseIdentity(taggedSource).tagTarget === git(taggedSource, ['rev-parse', 'HEAD']), 'fresh_clone_annotated_tag_passes');
  const previous = await readJson(path.join(root, 'release/previous-tags.json'));
  for (const entry of previous.tags) {
    if (git(root, ['rev-parse', `refs/tags/${entry.tag}`]) !== entry.object || git(root, ['rev-list', '-n', '1', `refs/tags/${entry.tag}`]) !== entry.target) throw new Error(`previous tag changed: ${entry.tag}`);
  }
  pass(true, 'previous_tags_unchanged');

  const { findFiles } = await import('./lib/destination-core.mjs');
  const generatedFiles = await findFiles(clean);
  const generatedText = await Promise.all(generatedFiles.map((file) => readFile(file, 'utf8').catch(() => '')));
  pass(!generatedText.join('\n').includes('@example.com') && !generatedText.join('\n').includes('example.org'), 'no_real_or_fabricated_leads_in_generated_destination');
  console.log(`test-communications: PASS (${passed} deterministic assertions; no network; no model; no leads)`);
} finally {
  const resolved = path.resolve(tempRoot);
  if (!resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`)) throw new Error('unsafe_test_cleanup_path');
  await rm(resolved, { recursive: true, force: true });
}
