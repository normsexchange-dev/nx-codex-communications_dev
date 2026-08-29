import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createAcknowledgementMessage, createEmptyChannel, deduplicateReferences, evaluateReaderPermissions,
  initializeChannelRoot, messageRelativePath, proposeMessage, schemaUrl, validateChannelRoot,
  validateCrossRepositoryReference, validateOutboundIndex, validatePairwiseMessage,
  validateReaderCache, validateWtbPayloadReference
} from '../scripts/lib/pairwise-channel.mjs';
import { sha256 } from '../scripts/lib/nx-interface.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const createdAt = '2026-08-27T12:00:00.000Z';

function temporary(t, prefix = 'nx-pairwise-') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function channelOptions(overrides = {}) {
  return {
    channelId: 'channel-alpha-publisher', channelVersion: '0.1.0',
    publisherEnvironment: 'alpha-environment', publisherRepository: 'alpha-owner/alpha-outbound',
    recipientEnvironment: 'beta-environment', reciprocalRepository: 'beta-owner/beta-outbound',
    createdAt, ...overrides
  };
}

function message(overrides = {}) {
  return {
    $schema: schemaUrl('pairwise-message.schema.json'), protocol_version: '0.6.0',
    message_id: 'msg-assignment-00000001', sequence: 1, channel_id: 'channel-alpha-publisher',
    sender_environment: 'alpha-environment', recipient_environment: 'beta-environment',
    message_type: 'assignment', created_at: createdAt,
    content: { subject: 'Synthetic assignment', summary: 'Reserved protocol fixture.', body: '' },
    payloads: [], references: [], acknowledgement_status: null,
    lifecycle: { status: 'published', supersedes_message_id: null }, ...overrides
  };
}

function reference(overrides = {}) {
  return {
    $schema: schemaUrl('cross-repository-reference.schema.json'), protocol_version: '0.6.0',
    source_repository_owner: 'alpha-owner', source_repository: 'alpha-owner/alpha-outbound',
    source_commit: 'a'.repeat(40), source_path: 'messages/000001-msg-assignment-00000001.json',
    source_message_id: 'msg-assignment-00000001', source_sha256: 'b'.repeat(64),
    source_channel_id: 'channel-alpha-publisher', ...overrides
  };
}

function applyProposal(channelRoot, proposalRoot) {
  const messageName = fs.readdirSync(path.join(proposalRoot, 'messages'))[0];
  fs.mkdirSync(path.join(channelRoot, 'messages'), { recursive: true });
  fs.copyFileSync(path.join(proposalRoot, 'messages', messageName), path.join(channelRoot, 'messages', messageName));
  fs.copyFileSync(path.join(proposalRoot, 'outbound', 'index.json'), path.join(channelRoot, 'outbound', 'index.json'));
}

test('empty channel initialization binds one publisher and leaves no message or reader state', async (t) => {
  const channelRoot = temporary(t);
  const result = await initializeChannelRoot(channelRoot, channelOptions());
  assert.equal(result.index.next_sequence, 1);
  assert.deepEqual(result.index.messages, []);
  const validated = await validateChannelRoot(channelRoot);
  assert.equal(validated.manifest.authority.publisher_write, 'exclusive');
  assert.equal(validated.manifest.authority.recipient_access, 'read_only');
  assert.deepEqual(validated.manifest.authority.recipient_mutations, []);
  assert.equal(fs.existsSync(path.join(channelRoot, 'messages')), false);
  assert.equal(fs.existsSync(path.join(channelRoot, 'reader-cache.json')), false);
  fs.writeFileSync(path.join(channelRoot, 'reader-cache.json'), '{}');
  await assert.rejects(validateChannelRoot(channelRoot), /publisher_repository_contains_reader_state/);
  assert.throws(() => createEmptyChannel(channelOptions({ reciprocalRepository: 'alpha-owner/alpha-outbound' })), /channel_repository_collision/);
});

test('owner proposal is sequential, indexed, digest-bound, and does not mutate the source channel', async (t) => {
  const channelRoot = temporary(t); const proposalRoot = temporary(t);
  await initializeChannelRoot(channelRoot, channelOptions());
  const before = fs.readFileSync(path.join(channelRoot, 'outbound', 'index.json'), 'utf8');
  const result = await proposeMessage(channelRoot, message(), proposalRoot);
  assert.equal(result.message_path, messageRelativePath(message()));
  assert.equal(fs.readFileSync(path.join(channelRoot, 'outbound', 'index.json'), 'utf8'), before);
  assert.equal(result.index.messages[0].sha256, sha256(fs.readFileSync(path.join(proposalRoot, result.message_path))));
  applyProposal(channelRoot, proposalRoot);
  assert.equal((await validateChannelRoot(channelRoot)).index.next_sequence, 2);
});

test('foreign sender, sequence gaps, dangling messages, digest drift, and path traversal fail closed', async (t) => {
  const channelRoot = temporary(t); await initializeChannelRoot(channelRoot, channelOptions());
  await assert.rejects(proposeMessage(channelRoot, message({ sender_environment: 'gamma-environment' }), temporary(t)), /proposal_sender_not_publisher/);
  await assert.rejects(proposeMessage(channelRoot, message({ sequence: 2 }), temporary(t)), /proposal_sequence_invalid/);
  assert.throws(() => validateCrossRepositoryReference(reference({ source_path: '../messages/000001-msg-assignment-00000001.json' })), /reference_path_invalid/);
  const proposalRoot = temporary(t); await proposeMessage(channelRoot, message(), proposalRoot); applyProposal(channelRoot, proposalRoot);
  fs.appendFileSync(path.join(channelRoot, 'messages', '000001-msg-assignment-00000001.json'), ' ');
  await assert.rejects(validateChannelRoot(channelRoot), /index_digest_mismatch/);
});

test('responses and acknowledgements are created only as new records in the responder channel', async (t) => {
  const responderRoot = temporary(t); const proposalRoot = temporary(t);
  await initializeChannelRoot(responderRoot, channelOptions({
    channelId: 'channel-beta-publisher', publisherEnvironment: 'beta-environment',
    publisherRepository: 'beta-owner/beta-outbound', recipientEnvironment: 'alpha-environment',
    reciprocalRepository: 'alpha-owner/alpha-outbound'
  }));
  const acknowledgement = createAcknowledgementMessage({
    reference: reference(), messageId: 'msg-acknowledgement-0001', sequence: 1,
    channelId: 'channel-beta-publisher', senderEnvironment: 'beta-environment',
    recipientEnvironment: 'alpha-environment', createdAt, status: 'validated',
    subject: 'Synthetic acknowledgment', summary: 'Source message validated.'
  });
  await proposeMessage(responderRoot, acknowledgement, proposalRoot);
  assert.equal(acknowledgement.references[0].source_repository, 'alpha-owner/alpha-outbound');
  assert.equal(acknowledgement.acknowledgement_status, 'validated');
  assert.equal(fs.existsSync(path.join(responderRoot, 'messages')), false);
});

test('correction and withdrawal are append-only and cannot self-reference or supersede missing records', async (t) => {
  const channelRoot = temporary(t); await initializeChannelRoot(channelRoot, channelOptions());
  const first = temporary(t); await proposeMessage(channelRoot, message(), first); applyProposal(channelRoot, first);
  const correction = message({
    message_id: 'msg-correction-00000002', sequence: 2, message_type: 'correction',
    content: { subject: 'Synthetic correction', summary: 'Corrects the fixture.', body: '' },
    lifecycle: { status: 'published', supersedes_message_id: 'msg-assignment-00000001' }
  });
  const second = temporary(t); await proposeMessage(channelRoot, correction, second); applyProposal(channelRoot, second);
  assert.equal((await validateChannelRoot(channelRoot)).index.messages.length, 2);
  assert.throws(() => validatePairwiseMessage({ ...correction, lifecycle: { status: 'published', supersedes_message_id: correction.message_id } }), /message_self_supersession/);
  await assert.rejects(proposeMessage(channelRoot, { ...correction, message_id: 'msg-correction-00000003', sequence: 3, lifecycle: { status: 'published', supersedes_message_id: 'msg-missing-0000000001' } }, temporary(t)), /proposal_supersedes_missing/);
});

test('reader cache validates and exact references deduplicate outside the publisher channel', () => {
  const cache = {
    $schema: schemaUrl('reader-cache.schema.json'), protocol_version: '0.6.0',
    channel_id: 'channel-alpha-publisher', publisher_repository: 'alpha-owner/alpha-outbound',
    last_commit: 'a'.repeat(40), last_sequence: 1, observed_at: createdAt,
    processed: [reference(), reference()]
  };
  assert.equal(validateReaderCache(cache).last_sequence, 1);
  assert.equal(deduplicateReferences(cache.processed).length, 1);
  assert.throws(() => validateReaderCache({ ...cache, last_commit: 'main' }), /reader_cache_source_invalid/);
});

test('permission verification requires pull and rejects every write-capable shape', () => {
  assert.equal(evaluateReaderPermissions({ pull: true, push: false, admin: false, maintain: false, triage: false }).status, 'READ_ONLY_VERIFIED');
  assert.equal(evaluateReaderPermissions({ pull: true, push: true, admin: false, maintain: false, triage: false }).status, 'READ_ONLY_NOT_VERIFIED');
  assert.equal(evaluateReaderPermissions({ pull: false, push: false, admin: false, maintain: false, triage: false }).status, 'READ_ONLY_NOT_VERIFIED');
});

test('WTB references bind exact contract and content digests but never admit data', () => {
  const payloadBytes = Buffer.from('{"contract_version":"0.2.0","records":[]}\n');
  const schemaBytes = Buffer.from('{"$id":"synthetic-contract-schema"}\n');
  const payload = {
    path: 'payloads/synthetic-wtb-batch.json', sha256: sha256(payloadBytes),
    media_type: 'application/vnd.nx.wtb-candidate-batch+json',
    contract: {
      repository: 'normsexchange-dev/nx-sourcing-contracts_dev', tag: 'contract-v0.2.0', version: '0.2.0',
      schema_path: 'schemas/wtb-candidate-batch.schema.json', schema_sha256: sha256(schemaBytes)
    }
  };
  assert.deepEqual(validateWtbPayloadReference(payload, payloadBytes, schemaBytes), { transport: 'VALID', contract_reference: 'VALID', data_admission: 'NOT_ADMITTED' });
  assert.throws(() => validateWtbPayloadReference({ ...payload, sha256: '0'.repeat(64) }, payloadBytes, schemaBytes), /wtb_payload_digest_mismatch/);
});

test('public v0.7 release preserves restrictive generic pairwise 0.6 semantics and GET-only readers', () => {
  for (const name of ['pairwise-channel', 'pairwise-message', 'cross-repository-reference', 'outbound-index', 'reader-cache']) {
    const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas', `${name}.schema.json`), 'utf8'));
    assert.equal(schema.additionalProperties, false);
    assert.match(schema.$id, /communications-v0\.7\.0/);
    if (schema.properties.protocol_version) assert.equal(schema.properties.protocol_version.const, '0.6.0');
  }
  assert.equal(fs.readdirSync(path.join(root, 'prompts', 'pairwise')).filter((name) => name.endsWith('.txt')).length, 8);
  const publicText = fs.readFileSync(path.join(root, 'docs', 'PAIRWISE_CHANNEL_PROTOCOL_dev.md'), 'utf8') + fs.readdirSync(path.join(root, 'prompts', 'pairwise')).map((name) => fs.readFileSync(path.join(root, 'prompts', 'pairwise', name), 'utf8')).join('\n');
  const privateMarkers = [['nx', 'to'].join('-'), ['gemini', 'intake'].join('-'), ['ai', 'agent', 'control'].join('-'), ['ai', 'agent', 'ops'].join('-')];
  for (const marker of privateMarkers) assert.equal(publicText.toLowerCase().includes(marker), false);
  for (const name of ['verify-reader-permission.mjs', 'consume-pairwise-channel.mjs']) {
    const source = fs.readFileSync(path.join(root, 'scripts', name), 'utf8');
    assert.match(source, /method:\s*'GET'/);
    assert.doesNotMatch(source, /method:\s*'(?:POST|PUT|PATCH|DELETE)'/);
  }
});

test('outbound index rejects gaps, cycles-by-order, and unindexed messages', () => {
  const { index } = createEmptyChannel(channelOptions());
  assert.throws(() => validateOutboundIndex({ ...index, next_sequence: 2 }), /index_next_sequence_invalid/);
  const invalidEntry = {
    sequence: 2, message_id: 'msg-correction-00000002', path: 'messages/000002-msg-correction-00000002.json',
    sha256: 'c'.repeat(64), message_type: 'correction', created_at: createdAt,
    lifecycle_status: 'published', supersedes_message_id: 'msg-assignment-00000001'
  };
  assert.throws(() => validateOutboundIndex({ ...index, next_sequence: 3, messages: [invalidEntry] }), /index_sequence_gap/);
});
