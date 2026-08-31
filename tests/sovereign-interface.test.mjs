import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { materialize } from '../scripts/materialize-genesis.mjs';
import { securityReview } from '../scripts/security-review.mjs';
import {
  CORE_SCHEMA_TAG, NX_FILES, SOURCE_REPOSITORY, SOVEREIGN_INTERFACE_VERSION, TAG, VERSION, coreDigestPayload, createSurface,
  hashJson, negotiateVersions
} from '../scripts/lib/nx-interface.mjs';
import { verifyInterface } from '../scripts/verify-interface.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const release = {
  repository: SOURCE_REPOSITORY, tag: TAG, tag_object: 'a'.repeat(40), target_commit: 'b'.repeat(40), source_digest: 'c'.repeat(64)
};
const base = {
  mode: 'fresh', owner: 'example-owner', repository: 'example-owner/sovereign-environment', environmentId: 'example-environment',
  runtime: 'model-neutral-runtime', humanPrincipal: 'Ray', genesisCommit: 'd'.repeat(40),
  materializedAt: '2026-08-27T00:00:00.000Z', release
};

function temporary(t, prefix = 'nx-sovereign-') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function nx(rootPath, name) { return path.join(rootPath, '.nx', name); }
function read(rootPath, name) { return JSON.parse(fs.readFileSync(nx(rootPath, name), 'utf8')); }
function write(rootPath, name, value) { fs.writeFileSync(nx(rootPath, name), `${JSON.stringify(value, null, 2)}\n`); }

function rehash(rootPath) {
  const environment = read(rootPath, 'environment.json');
  const lineage = read(rootPath, 'lineage.json');
  const capabilities = read(rootPath, 'capabilities.json');
  const provenance = read(rootPath, 'provenance.json');
  const interoperability = read(rootPath, 'interoperability.json');
  const genesis = read(rootPath, 'genesis.json');
  genesis.initial_core_digest = hashJson(coreDigestPayload(environment, lineage, capabilities, provenance, interoperability));
  write(rootPath, 'genesis.json', genesis);
  interoperability.hashes = {
    'capabilities.json': hashJson(capabilities), 'environment.json': hashJson(environment),
    'genesis.json': hashJson(genesis), 'lineage.json': hashJson(lineage), 'provenance.json': hashJson(provenance)
  };
  write(rootPath, 'interoperability.json', interoperability);
}

test('fresh genesis is exact, records release identity and sovereignty transfer, and is idempotent', async (t) => {
  const outputRoot = temporary(t);
  const first = await materialize({ ...base, outputRoot });
  assert.equal(first.status, 'MATERIALIZED');
  assert.deepEqual(fs.readdirSync(path.join(outputRoot, '.nx')).sort(), NX_FILES);
  const result = await verifyInterface(outputRoot, { expectedRepository: base.repository, commit: 'e'.repeat(40) });
  assert.equal(result.genesis, 'GENESIS_VALIDATED');
  assert.equal(result.interface, 'INTERFACE_COMPATIBLE');
  const genesis = read(outputRoot, 'genesis.json');
  assert.deepEqual(genesis.canonical_release, release);
  assert.deepEqual(genesis.sovereignty_transfer, { state: 'transferred', recipient: base.repository, effective_at: base.materializedAt });
  assert.equal((await materialize({ ...base, outputRoot })).status, 'IDEMPOTENT');
});

test('v0.8 verifier remains compatible with an immutable v0.5 sovereign surface', async (t) => {
  const outputRoot = temporary(t);
  await materialize({ ...base, outputRoot });
  for (const name of NX_FILES) {
    const document = read(outputRoot, name);
    document.$schema = document.$schema.replace(CORE_SCHEMA_TAG, 'communications-v0.5.0');
    write(outputRoot, name, document);
  }
  const genesis = read(outputRoot, 'genesis.json');
  genesis.canonical_release.tag = 'communications-v0.5.0';
  genesis.materializer.version = '0.5.0';
  write(outputRoot, 'genesis.json', genesis);
  const lineage = read(outputRoot, 'lineage.json');
  lineage.canonical_genesis.tag = 'communications-v0.5.0';
  write(outputRoot, 'lineage.json', lineage);
  rehash(outputRoot);
  const result = await verifyInterface(outputRoot, { expectedRepository: base.repository });
  assert.equal(result.interface, 'INTERFACE_COMPATIBLE');
  assert.equal(result.negotiated_version, '0.5.0');
});

test('v0.8 verifier remains compatible with an immutable v0.7 genesis release', async (t) => {
  const outputRoot = temporary(t);
  await materialize({ ...base, outputRoot });
  for (const name of NX_FILES) {
    const document = read(outputRoot, name);
    document.$schema = document.$schema.replace(CORE_SCHEMA_TAG, 'communications-v0.7.0');
    write(outputRoot, name, document);
  }
  const genesis = read(outputRoot, 'genesis.json');
  genesis.canonical_release.tag = 'communications-v0.7.0';
  genesis.materializer.version = '0.7.0';
  write(outputRoot, 'genesis.json', genesis);
  const lineage = read(outputRoot, 'lineage.json');
  lineage.canonical_genesis.tag = 'communications-v0.7.0';
  write(outputRoot, 'lineage.json', lineage);
  rehash(outputRoot);
  const result = await verifyInterface(outputRoot, { expectedRepository: base.repository });
  assert.equal(result.interface, 'INTERFACE_COMPATIBLE');
});

test('fresh genesis rejects nonempty output, false owner/repository identity, and invalid anchors', async (t) => {
  const nonempty = temporary(t);
  fs.writeFileSync(path.join(nonempty, 'existing.txt'), 'owner data');
  await assert.rejects(materialize({ ...base, outputRoot: nonempty }), /genesis_output_not_empty/);
  assert.throws(() => createSurface({ ...base, owner: 'different-owner' }), /identity_owner_repository_collision/);
  assert.throws(() => createSurface({ ...base, genesisCommit: 'main' }), /genesis_commit_invalid/);
  assert.throws(() => createSurface({ ...base, release: { ...release, tag: 'main' } }), /genesis_release_invalid/);
});

test('sovereign evolution outside .nx is ignored without implying trust', async (t) => {
  const outputRoot = temporary(t);
  await materialize({ ...base, outputRoot });
  const evolved = [
    'package.json', 'server.mjs', 'AGENTS.md', 'EVOLUTION.md', 'unknown.bin', 'src/app.mjs', 'server/api.mjs',
    'data/simulation.json', 'agents/blueprints/research.json', 'replication/child-plan.json', 'app/index.html'
  ];
  for (const relative of evolved) {
    fs.mkdirSync(path.dirname(path.join(outputRoot, relative)), { recursive: true });
    fs.writeFileSync(path.join(outputRoot, relative), relative.endsWith('.json') ? '{}\n' : 'sovereign fixture\n');
  }
  const result = await verifyInterface(outputRoot, { expectedRepository: base.repository });
  assert.equal(result.interface, 'INTERFACE_COMPATIBLE');
  assert.equal(result.credential_review, 'UNKNOWN');
  assert.equal(result.external_access, 'UNKNOWN');
  assert.equal((await materialize({ ...base, outputRoot })).status, 'IDEMPOTENT');
});

test('adoption writes only a separate proposal and preserves existing autonomous repository bytes', async (t) => {
  const destinationRoot = temporary(t, 'nx-existing-');
  const proposalRoot = temporary(t, 'nx-proposal-');
  fs.writeFileSync(path.join(destinationRoot, 'EVOLUTION.md'), 'existing autonomous history\n');
  fs.mkdirSync(path.join(destinationRoot, 'agents'));
  fs.writeFileSync(path.join(destinationRoot, 'agents', 'founder.json'), '{"role":"founder"}\n');
  const before = fs.readFileSync(path.join(destinationRoot, 'EVOLUTION.md'), 'utf8');
  const result = await materialize({ ...base, mode: 'adopt', destinationRoot, proposalRoot, historicalGenesis: 'communications-v0.2.0 reported' });
  assert.equal(result.status, 'PROPOSED');
  assert.equal(result.destination_mutated, false);
  assert.equal(fs.readFileSync(path.join(destinationRoot, 'EVOLUTION.md'), 'utf8'), before);
  assert.equal(fs.existsSync(path.join(destinationRoot, '.nx')), false);
  assert.equal((await verifyInterface(proposalRoot, { expectedRepository: base.repository })).interface, 'INTERFACE_COMPATIBLE');
});

test('descendants preserve truthful parent lineage and reject impersonation or collision', async (t) => {
  const outputRoot = temporary(t);
  const child = {
    ...base, mode: 'descendant', owner: 'child-owner', repository: 'child-owner/child-environment', environmentId: 'child-environment',
    parentOwner: base.owner, parentRepository: base.repository, parentEnvironmentId: base.environmentId,
    parentCommit: 'e'.repeat(40), outputRoot
  };
  await materialize(child);
  const lineage = read(outputRoot, 'lineage.json');
  assert.equal(lineage.lineage_type, 'descendant');
  assert.equal(lineage.parent.repository, base.repository);
  assert.equal((await verifyInterface(outputRoot, { expectedRepository: child.repository })).interface, 'INTERFACE_COMPATIBLE');
  assert.throws(() => createSurface({ ...child, repository: base.repository, owner: base.owner }), /lineage_child_repository_collision/);
  assert.throws(() => createSurface({ ...child, environmentId: base.environmentId }), /lineage_child_environment_collision/);
  lineage.current = { environment_id: base.environmentId, repository: base.repository };
  write(outputRoot, 'lineage.json', lineage); rehash(outputRoot);
  assert.equal((await verifyInterface(outputRoot, { expectedRepository: child.repository })).interface, 'INTERFACE_INCOMPATIBLE');
});

test('hybrid and declared divergent lineage remain compatible when identity stays truthful', async (t) => {
  const outputRoot = temporary(t);
  await materialize({ ...base, outputRoot });
  const lineage = read(outputRoot, 'lineage.json');
  lineage.lineage_type = 'hybrid';
  lineage.parent = { environment_id: 'parent-environment', repository: 'parent-owner/parent-repository', commit: 'f'.repeat(40) };
  lineage.divergence = { allowed: true, declared: true, description: 'Sovereign hybrid evolution.' };
  write(outputRoot, 'lineage.json', lineage); rehash(outputRoot);
  assert.equal((await verifyInterface(outputRoot, { expectedRepository: base.repository })).interface, 'INTERFACE_COMPATIBLE');
});

test('missing, malformed, stale, and hash-drifted reserved interfaces fail independently', async (t) => {
  const absent = temporary(t);
  fs.writeFileSync(path.join(absent, 'application.mjs'), 'autonomous app');
  let result = await verifyInterface(absent, { expectedRepository: base.repository });
  assert.equal(result.interface, 'NOT_YET_ADOPTED');
  assert.equal(result.genesis, 'GENESIS_UNVERIFIED');

  const outputRoot = temporary(t);
  await materialize({ ...base, outputRoot });
  fs.writeFileSync(nx(outputRoot, 'provenance.json'), '{malformed');
  result = await verifyInterface(outputRoot, { expectedRepository: base.repository });
  assert.equal(result.interface, 'INTERFACE_INCOMPATIBLE');
  assert.equal(result.external_access, 'UNKNOWN');

  const staleRoot = temporary(t);
  await materialize({ ...base, outputRoot: staleRoot });
  const interop = read(staleRoot, 'interoperability.json');
  interop.current = '0.4.0'; write(staleRoot, 'interoperability.json', interop);
  result = await verifyInterface(staleRoot, { expectedRepository: base.repository });
  assert.equal(result.interface, 'INTERFACE_INCOMPATIBLE');

  const driftRoot = temporary(t);
  await materialize({ ...base, outputRoot: driftRoot });
  const environment = read(driftRoot, 'environment.json'); environment.runtime = 'changed-runtime'; write(driftRoot, 'environment.json', environment);
  result = await verifyInterface(driftRoot, { expectedRepository: base.repository });
  assert.equal(result.interface, 'INTERFACE_INCOMPATIBLE');
});

test('version negotiation is receiver-oriented and fails closed with no common version', () => {
  const sender = { supported: ['0.5.0', '0.6.0'], preferred: '0.6.0', unsupported: [] };
  const receiver = { supported: ['0.5.0', '0.7.0'], preferred: '0.5.0', unsupported: [] };
  assert.deepEqual(negotiateVersions(sender, receiver), { status: 'NEGOTIATED', selected: '0.5.0', common: ['0.5.0'] });
  assert.deepEqual(negotiateVersions(sender, { supported: ['1.0.0'], preferred: '1.0.0', unsupported: [] }), { status: 'NO_COMMON_VERSION', selected: null, common: [] });
});

test('provenance labels are preserved and protected promotions require evidence and assigner', async (t) => {
  const outputRoot = temporary(t);
  await materialize({ ...base, outputRoot });
  const provenance = read(outputRoot, 'provenance.json');
  provenance.records.push({ record_id: 'obs-1', classification: 'public_observation', subject: 'reserved example', evidence_refs: ['https://example.invalid/evidence'], observed_at: base.materializedAt, assigned_by: base.environmentId });
  write(outputRoot, 'provenance.json', provenance); rehash(outputRoot);
  assert.equal((await verifyInterface(outputRoot, { expectedRepository: base.repository })).interface, 'INTERFACE_COMPATIBLE');

  provenance.records[0] = { ...provenance.records[0], classification: 'norms_verified', assigned_by: base.environmentId };
  write(outputRoot, 'provenance.json', provenance); rehash(outputRoot);
  assert.equal((await verifyInterface(outputRoot, { expectedRepository: base.repository })).interface, 'INTERFACE_INCOMPATIBLE');

  provenance.records[0] = { ...provenance.records[0], classification: 'buyer_confirmed', assigned_by: base.environmentId, evidence_refs: ['https://example.invalid/buyer-report'] };
  write(outputRoot, 'provenance.json', provenance); rehash(outputRoot);
  assert.equal((await verifyInterface(outputRoot, { expectedRepository: base.repository })).interface, 'INTERFACE_INCOMPATIBLE');

  provenance.records[0] = { ...provenance.records[0], classification: 'public_observation', assigned_by: base.environmentId, evidence_refs: [] };
  write(outputRoot, 'provenance.json', provenance); rehash(outputRoot);
  assert.equal((await verifyInterface(outputRoot, { expectedRepository: base.repository })).interface, 'INTERFACE_INCOMPATIBLE');
});

test('capability declarations do not create access and human authorization must name the principal', async (t) => {
  const outputRoot = temporary(t);
  await materialize({ ...base, outputRoot });
  const capabilities = read(outputRoot, 'capabilities.json');
  capabilities.declarations.push({ capability_id: 'research.public', scope: 'internal', state: 'ray_standing_authorized', authorized_by: 'Ray', valid_from: base.materializedAt, expires_at: null, evidence_refs: ['standing-mission-reference'] });
  write(outputRoot, 'capabilities.json', capabilities); rehash(outputRoot);
  let result = await verifyInterface(outputRoot, { expectedRepository: base.repository });
  assert.equal(result.interface, 'INTERFACE_COMPATIBLE');
  assert.equal(result.external_access, 'UNKNOWN');
  capabilities.declarations[0].authorized_by = base.environmentId;
  write(outputRoot, 'capabilities.json', capabilities); rehash(outputRoot);
  result = await verifyInterface(outputRoot, { expectedRepository: base.repository });
  assert.equal(result.interface, 'INTERFACE_INCOMPATIBLE');
});

test('credential review is separate, detects browser PAT design, and never prints a value', async (t) => {
  const fixture = temporary(t);
  fs.writeFileSync(path.join(fixture, 'browser.js'), 'localStorage.setItem("github_token", userInput);\n');
  let result = await securityReview(fixture);
  assert.equal(result.credential_review, 'REVIEW_REQUIRED');
  assert.equal(result.findings[0].code, 'browser_token_storage_design');
  const synthetic = ['gh', 'p_', 'A'.repeat(24)].join('');
  fs.writeFileSync(path.join(fixture, 'unsafe.txt'), synthetic);
  result = await securityReview(fixture);
  assert.equal(result.credential_review, 'EXPOSED');
  assert.equal(JSON.stringify(result).includes(synthetic), false);
});

test('public source preserves v0.5 sovereign semantics and adds eight generic pairwise prompts', () => {
  for (const name of ['nx-capabilities', 'nx-environment', 'nx-genesis', 'nx-interoperability', 'nx-lineage', 'nx-provenance']) {
    const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas', `${name}.schema.json`), 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.additionalProperties, false);
  }
  const currentPrompts = fs.readdirSync(path.join(root, 'prompts')).filter((name) => name.endsWith('.txt') && !name.startsWith('gemini-') && !['codex-independent-verification.txt', 'emergency-stop-revoke-access.txt'].includes(name));
  assert.equal(currentPrompts.length, 7);
  assert.equal(fs.readdirSync(path.join(root, 'prompts', 'pairwise')).filter((name) => name.endsWith('.txt')).length, 8);
  assert.equal(fs.existsSync(path.join(root, 'prompts', 'private-intake-connection.txt')), false);
  const previous = JSON.parse(fs.readFileSync(path.join(root, 'release', 'previous-tags.json'), 'utf8'));
  assert.equal(previous.tags.length, 9);
  assert.equal(previous.tags.at(-1).tag, 'communications-v0.7.0');
  assert.equal(VERSION, '0.8.0');
  assert.equal(SOVEREIGN_INTERFACE_VERSION, '0.5.0');
});

test('Autostart pins one exact operating profile while keeping adoption separately authorized', () => {
  const reference = JSON.parse(fs.readFileSync(path.join(root, 'release', 'environment-profile.json'), 'utf8'));
  const autostart = fs.readFileSync(path.join(root, 'AUTOSTART.md'), 'utf8');
  assert.equal(reference.profile_id, 'persistent-multi-agent-github');
  assert.equal(reference.profile_version, '1.0.0');
  assert.match(reference.tag_object, /^[a-f0-9]{40}$/);
  assert.match(reference.tag_target, /^[a-f0-9]{40}$/);
  assert.equal(reference.adoption_is_separate_authority, true);
  for (const mode of ['session-only', 'persistent-single-agent', 'persistent-multi-agent', 'enroll-existing']) assert.match(autostart, new RegExp(mode));
  assert.match(autostart, /Never duplicate an existing environment/);
  assert.match(autostart, /Stop before mission activation/);
});
