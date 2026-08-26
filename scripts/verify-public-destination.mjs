import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALLOWED_DESTINATION_PATHS,
  MISSION_ACKNOWLEDGMENT_ID,
  SOURCE_REPOSITORY,
  TAG,
  VALIDATOR_VERSION,
  assert,
  sanitizedErrorCode,
  stableStringify,
  validateDestination
} from './lib/destination-core.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;

function requestJson(apiPath) {
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'api.github.com',
      path: apiPath,
      method: 'GET',
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': `nx-public-destination-verifier-${VALIDATOR_VERSION}`, 'X-GitHub-Api-Version': '2022-11-28' }
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error(`github_api_status_${response.statusCode}`));
        try { resolve(JSON.parse(body)); } catch { reject(new Error('github_api_invalid_json')); }
      });
    });
    request.setTimeout(20000, () => request.destroy(new Error('github_api_timeout')));
    request.on('error', () => reject(new Error('github_api_unavailable')));
    request.end();
  });
}

function safeDestination(root, relativePath) {
  assert(!path.isAbsolute(relativePath) && !relativePath.split('/').includes('..'), 'unsafe_destination_path');
  const destination = path.resolve(root, ...relativePath.split('/'));
  assert(destination.startsWith(`${path.resolve(root)}${path.sep}`), 'unsafe_destination_path');
  return destination;
}

export async function verifyPreparedDestination({
  root,
  repository,
  destinationCommit,
  initializingCommit,
  readyCommit,
  sourceTagObject,
  sourceTagTarget,
  workflowRuns,
  missionAcknowledgmentId = MISSION_ACKNOWLEDGMENT_ID
}) {
  assert(REPOSITORY_PATTERN.test(repository), 'destination_repository_invalid');
  for (const value of [destinationCommit, initializingCommit, readyCommit, sourceTagObject, sourceTagTarget]) assert(SHA_PATTERN.test(value), 'git_commit_or_object_invalid');
  assert(destinationCommit === readyCommit && initializingCommit !== readyCommit, 'readiness_commit_sequence_invalid');
  assert(missionAcknowledgmentId === MISSION_ACKNOWLEDGMENT_ID, 'mission_acknowledgment_id_invalid');
  const validation = await validateDestination(root, { expectedRepository: repository });
  assert(validation.status === 'ready', 'destination_not_ready');
  assert(validation.source_tag_object === sourceTagObject && validation.source_tag_target === sourceTagTarget, 'source_release_evidence_mismatch');
  assert(Array.isArray(workflowRuns) && workflowRuns.length === 2, 'workflow_evidence_count_invalid');
  const expectedCommits = [initializingCommit, readyCommit];
  for (let index = 0; index < workflowRuns.length; index += 1) {
    const run = workflowRuns[index];
    assert(run.commit === expectedCommits[index] && Number.isInteger(run.run_id) && run.run_id > 0 && run.conclusion === 'success', 'workflow_evidence_invalid');
  }
  return {
    schema_version: '1.0.0',
    source_release: TAG,
    source_tag_object: sourceTagObject,
    source_tag_target: sourceTagTarget,
    destination_repository: repository,
    destination_commit: destinationCommit,
    core_digest: validation.core_digest,
    initializing_commit: initializingCommit,
    ready_commit: readyCommit,
    workflow_runs: workflowRuns,
    mission_acknowledgment_id: missionAcknowledgmentId,
    validator_version: VALIDATOR_VERSION,
    result: 'GO'
  };
}

async function downloadDestination(repository, commit, root) {
  const tree = await requestJson(`/repos/${repository}/git/trees/${commit}?recursive=1`);
  assert(tree.truncated === false, 'destination_tree_truncated');
  const blobs = tree.tree.filter((entry) => entry.type === 'blob').map((entry) => ({ path: entry.path, sha: entry.sha })).sort((left, right) => left.path.localeCompare(right.path));
  assert(stableStringify(blobs.map((entry) => entry.path)) === stableStringify(ALLOWED_DESTINATION_PATHS), 'destination_tree_not_exact');
  for (const entry of blobs) {
    const blob = await requestJson(`/repos/${repository}/git/blobs/${entry.sha}`);
    assert(blob.encoding === 'base64' && typeof blob.content === 'string', 'destination_blob_encoding_invalid');
    const destination = safeDestination(root, entry.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, Buffer.from(blob.content.replace(/\s/g, ''), 'base64'));
  }
}

async function onlineEvidence(options, root) {
  await downloadDestination(options.repository, options.commit, root);
  const sourceRef = await requestJson(`/repos/${SOURCE_REPOSITORY}/git/ref/tags/${TAG}`);
  assert(sourceRef.object?.type === 'tag', 'source_release_not_annotated');
  const sourceTag = await requestJson(`/repos/${SOURCE_REPOSITORY}/git/tags/${sourceRef.object.sha}`);
  assert(sourceTag.object?.type === 'commit', 'source_release_target_invalid');
  const runsResponse = await requestJson(`/repos/${options.repository}/actions/workflows/validate-communications.yml/runs?branch=main&event=push&per_page=100`);
  const requested = [options.initializingCommit, options.readyCommit].map((commit) => {
    const matches = runsResponse.workflow_runs.filter((run) => run.head_sha === commit && run.status === 'completed' && run.conclusion === 'success');
    assert(matches.length >= 1, 'required_workflow_run_missing');
    return { commit, run_id: matches[0].id, conclusion: matches[0].conclusion };
  });
  return verifyPreparedDestination({
    root,
    repository: options.repository,
    destinationCommit: options.commit,
    initializingCommit: options.initializingCommit,
    readyCommit: options.readyCommit,
    sourceTagObject: sourceRef.object.sha,
    sourceTagTarget: sourceTag.object.sha,
    workflowRuns: requested,
    missionAcknowledgmentId: options.missionAcknowledgmentId
  });
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--') || index + 1 >= argv.length) throw new Error('invalid_arguments');
    values[key.slice(2)] = argv[++index];
  }
  for (const required of ['repository', 'commit', 'initializing-commit', 'ready-commit', 'mission-acknowledgment-id']) assert(values[required], `missing_argument:${required}`);
  return {
    repository: values.repository,
    commit: values.commit,
    initializingCommit: values['initializing-commit'],
    readyCommit: values['ready-commit'],
    missionAcknowledgmentId: values['mission-acknowledgment-id']
  };
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'nx-public-destination-'));
  try {
    const attestation = await onlineEvidence(parseArguments(process.argv.slice(2)), tempRoot);
    console.log(JSON.stringify(attestation));
  } catch (error) {
    console.log(JSON.stringify({ schema_version: '1.0.0', validator_version: VALIDATOR_VERSION, result: 'NO-GO', finding_codes: [sanitizedErrorCode(error)] }));
    process.exitCode = 1;
  } finally {
    const resolvedTemp = path.resolve(tempRoot);
    assert(resolvedTemp.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`), 'unsafe_temporary_cleanup_path');
    await rm(resolvedTemp, { recursive: true, force: true });
  }
}
