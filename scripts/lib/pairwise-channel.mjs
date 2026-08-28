import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { assert, exactKeys, prettyJson, readJson, sha256, stableStringify } from './nx-interface.mjs';

export const PAIRWISE_PROTOCOL_VERSION = '0.6.0';
export const CHANNEL_SCHEMA_VERSION = '1.0.0';
export const ACKNOWLEDGEMENT_STATUSES = [
  'received', 'validated', 'accepted', 'rejected', 'needs_information',
  'superseded', 'withdrawn', 'incompatible', 'unauthorized_boundary'
];
export const MESSAGE_TYPES = [
  'assignment', 'notification', 'response', 'acknowledgement', 'status',
  'correction', 'withdrawal', 'protocol_notice'
];
export const LIFECYCLE_STATUSES = ['published', 'superseded', 'withdrawn'];
export const WTB_CONTRACT = Object.freeze({
  repository: 'normsexchange-dev/nx-sourcing-contracts_dev',
  tag: 'contract-v0.2.0',
  version: '0.2.0',
  schemas: ['schemas/wtb-candidate.schema.json', 'schemas/wtb-candidate-batch.schema.json']
});

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const ENVIRONMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CHANNEL_ID = /^channel-[a-z0-9][a-z0-9-]{7,79}$/;
const MESSAGE_ID = /^msg-[a-z0-9][a-z0-9-]{15,79}$/;
const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MESSAGE_PATH = /^messages\/[0-9]{6}-msg-[a-z0-9][a-z0-9-]{15,79}\.json$/;

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function dateTime(value, code) {
  assert(typeof value === 'string' && Number.isFinite(Date.parse(value)), code);
}

function boundedString(value, code, maximum = 4000) {
  assert(typeof value === 'string' && value.trim().length > 0 && value.length <= maximum, code);
}

function safeRelative(value, code) {
  assert(typeof value === 'string' && value.length > 0 && !value.includes('\\'), code);
  assert(!path.posix.isAbsolute(value) && !value.split('/').includes('..'), code);
}

function repositoryOwner(repository) {
  return repository.split('/')[0];
}

export function schemaUrl(name) {
  return `https://raw.githubusercontent.com/normsexchange-dev/nx-codex-communications_dev/communications-v${PAIRWISE_PROTOCOL_VERSION}/schemas/${name}`;
}

export function validateChannelManifest(manifest) {
  exactKeys(manifest, [
    '$schema', 'schema_version', 'protocol_version', 'channel_version', 'channel_id',
    'publisher', 'recipient', 'authority', 'message_path_pattern', 'index_path',
    'reader_state_location', 'created_at'
  ], 'pairwise_channel');
  assert(manifest.$schema === schemaUrl('pairwise-channel.schema.json'), 'channel_schema_identity_invalid');
  assert(manifest.schema_version === CHANNEL_SCHEMA_VERSION, 'channel_schema_version_invalid');
  assert(manifest.protocol_version === PAIRWISE_PROTOCOL_VERSION, 'channel_protocol_version_invalid');
  assert(/^0\.[0-9]+\.[0-9]+$/.test(manifest.channel_version), 'channel_version_invalid');
  assert(CHANNEL_ID.test(manifest.channel_id), 'channel_id_invalid');
  exactKeys(manifest.publisher, ['environment_id', 'repository'], 'channel_publisher');
  exactKeys(manifest.recipient, ['environment_id', 'reciprocal_repository'], 'channel_recipient');
  assert(ENVIRONMENT.test(manifest.publisher.environment_id), 'channel_publisher_environment_invalid');
  assert(REPOSITORY.test(manifest.publisher.repository), 'channel_publisher_repository_invalid');
  assert(ENVIRONMENT.test(manifest.recipient.environment_id), 'channel_recipient_environment_invalid');
  assert(REPOSITORY.test(manifest.recipient.reciprocal_repository), 'channel_reciprocal_repository_invalid');
  assert(manifest.publisher.repository !== manifest.recipient.reciprocal_repository, 'channel_repository_collision');
  exactKeys(manifest.authority, [
    'repository_owner', 'publisher_write', 'recipient_access', 'recipient_mutations', 'response_location'
  ], 'channel_authority');
  assert(manifest.authority.repository_owner === repositoryOwner(manifest.publisher.repository), 'channel_owner_mismatch');
  assert(manifest.authority.publisher_write === 'exclusive', 'channel_publisher_not_exclusive');
  assert(manifest.authority.recipient_access === 'read_only', 'channel_recipient_not_read_only');
  assert(Array.isArray(manifest.authority.recipient_mutations) && manifest.authority.recipient_mutations.length === 0, 'channel_recipient_mutations_present');
  assert(manifest.authority.response_location === 'recipient_outbound_repository', 'channel_response_location_invalid');
  assert(manifest.message_path_pattern === 'messages/{sequence:6}-{message_id}.json', 'channel_message_pattern_invalid');
  assert(manifest.index_path === 'outbound/index.json', 'channel_index_path_invalid');
  assert(manifest.reader_state_location === 'reader_environment_only', 'channel_reader_state_invalid');
  dateTime(manifest.created_at, 'channel_created_at_invalid');
  return manifest;
}

export function validateCrossRepositoryReference(reference) {
  exactKeys(reference, [
    '$schema', 'protocol_version', 'source_repository_owner', 'source_repository',
    'source_commit', 'source_path', 'source_message_id', 'source_sha256', 'source_channel_id'
  ], 'cross_repository_reference');
  assert(reference.$schema === schemaUrl('cross-repository-reference.schema.json'), 'reference_schema_identity_invalid');
  assert(reference.protocol_version === PAIRWISE_PROTOCOL_VERSION, 'reference_protocol_invalid');
  assert(REPOSITORY.test(reference.source_repository), 'reference_repository_invalid');
  assert(reference.source_repository_owner === repositoryOwner(reference.source_repository), 'reference_owner_mismatch');
  assert(SHA.test(reference.source_commit), 'reference_commit_invalid');
  safeRelative(reference.source_path, 'reference_path_invalid');
  assert(MESSAGE_PATH.test(reference.source_path), 'reference_message_path_invalid');
  assert(MESSAGE_ID.test(reference.source_message_id), 'reference_message_id_invalid');
  assert(reference.source_path.endsWith(`-${reference.source_message_id}.json`), 'reference_path_message_collision');
  assert(SHA256.test(reference.source_sha256), 'reference_digest_invalid');
  assert(CHANNEL_ID.test(reference.source_channel_id), 'reference_channel_invalid');
  return reference;
}

function validateContractReference(contract, payload) {
  exactKeys(contract, ['repository', 'tag', 'version', 'schema_path', 'schema_sha256'], 'payload_contract');
  assert(contract.repository === WTB_CONTRACT.repository, 'wtb_contract_repository_invalid');
  assert(contract.tag === WTB_CONTRACT.tag && contract.version === WTB_CONTRACT.version, 'wtb_contract_release_invalid');
  assert(WTB_CONTRACT.schemas.includes(contract.schema_path), 'wtb_contract_schema_invalid');
  assert(SHA256.test(contract.schema_sha256), 'wtb_contract_schema_digest_invalid');
  assert(contract.schema_path.endsWith('batch.schema.json') === payload.media_type.endsWith('candidate-batch+json'), 'wtb_contract_media_schema_mismatch');
}

function validatePayload(payload) {
  exactKeys(payload, ['path', 'sha256', 'media_type', 'contract'], 'message_payload');
  safeRelative(payload.path, 'payload_path_invalid');
  assert(payload.path.startsWith('payloads/') && payload.path.endsWith('.json'), 'payload_path_scope_invalid');
  assert(SHA256.test(payload.sha256), 'payload_digest_invalid');
  assert(['application/json', 'application/vnd.nx.wtb-candidate+json', 'application/vnd.nx.wtb-candidate-batch+json'].includes(payload.media_type), 'payload_media_type_invalid');
  if (payload.contract === null) assert(payload.media_type === 'application/json', 'payload_contract_required');
  else validateContractReference(payload.contract, payload);
}

export function validatePairwiseMessage(message) {
  exactKeys(message, [
    '$schema', 'protocol_version', 'message_id', 'sequence', 'channel_id', 'sender_environment',
    'recipient_environment', 'message_type', 'created_at', 'content', 'payloads', 'references',
    'acknowledgement_status', 'lifecycle'
  ], 'pairwise_message');
  assert(message.$schema === schemaUrl('pairwise-message.schema.json'), 'message_schema_identity_invalid');
  assert(message.protocol_version === PAIRWISE_PROTOCOL_VERSION, 'message_protocol_invalid');
  assert(MESSAGE_ID.test(message.message_id), 'message_id_invalid');
  assert(Number.isInteger(message.sequence) && message.sequence >= 1, 'message_sequence_invalid');
  assert(CHANNEL_ID.test(message.channel_id), 'message_channel_invalid');
  assert(ENVIRONMENT.test(message.sender_environment) && ENVIRONMENT.test(message.recipient_environment), 'message_environment_invalid');
  assert(message.sender_environment !== message.recipient_environment, 'message_environment_collision');
  assert(MESSAGE_TYPES.includes(message.message_type), 'message_type_invalid');
  dateTime(message.created_at, 'message_created_at_invalid');
  exactKeys(message.content, ['subject', 'summary', 'body'], 'message_content');
  boundedString(message.content.subject, 'message_subject_invalid', 240);
  boundedString(message.content.summary, 'message_summary_invalid', 1000);
  assert(typeof message.content.body === 'string' && message.content.body.length <= 20000, 'message_body_invalid');
  assert(Array.isArray(message.payloads) && message.payloads.length <= 20, 'message_payloads_invalid');
  message.payloads.forEach(validatePayload);
  assert(new Set(message.payloads.map((item) => item.path)).size === message.payloads.length, 'message_payload_duplicate');
  assert(Array.isArray(message.references) && message.references.length <= 20, 'message_references_invalid');
  message.references.forEach(validateCrossRepositoryReference);
  exactKeys(message.lifecycle, ['status', 'supersedes_message_id'], 'message_lifecycle');
  assert(LIFECYCLE_STATUSES.includes(message.lifecycle.status), 'message_lifecycle_status_invalid');
  assert(message.lifecycle.supersedes_message_id === null || MESSAGE_ID.test(message.lifecycle.supersedes_message_id), 'message_supersedes_invalid');
  assert(message.lifecycle.supersedes_message_id !== message.message_id, 'message_self_supersession');
  const response = ['response', 'acknowledgement'].includes(message.message_type);
  assert(response === (message.acknowledgement_status !== null), 'message_acknowledgement_status_mismatch');
  if (response) {
    assert(ACKNOWLEDGEMENT_STATUSES.includes(message.acknowledgement_status), 'message_acknowledgement_status_invalid');
    assert(message.references.length >= 1, 'message_response_reference_required');
  }
  if (['correction', 'withdrawal'].includes(message.message_type)) assert(message.lifecycle.supersedes_message_id !== null, 'message_supersession_required');
  else assert(message.lifecycle.supersedes_message_id === null, 'message_supersession_not_allowed');
  return message;
}

export function messageRelativePath(message) {
  validatePairwiseMessage(message);
  return `messages/${String(message.sequence).padStart(6, '0')}-${message.message_id}.json`;
}

export function validateOutboundIndex(index, messages = new Map()) {
  exactKeys(index, ['$schema', 'protocol_version', 'channel_version', 'channel_id', 'publisher_repository', 'next_sequence', 'messages'], 'outbound_index');
  assert(index.$schema === schemaUrl('outbound-index.schema.json'), 'index_schema_identity_invalid');
  assert(index.protocol_version === PAIRWISE_PROTOCOL_VERSION, 'index_protocol_invalid');
  assert(/^0\.[0-9]+\.[0-9]+$/.test(index.channel_version), 'index_channel_version_invalid');
  assert(CHANNEL_ID.test(index.channel_id) && REPOSITORY.test(index.publisher_repository), 'index_identity_invalid');
  assert(Array.isArray(index.messages), 'index_messages_invalid');
  const ids = new Set();
  for (const [position, entry] of index.messages.entries()) {
    exactKeys(entry, ['sequence', 'message_id', 'path', 'sha256', 'message_type', 'created_at', 'lifecycle_status', 'supersedes_message_id'], `index_message_${position}`);
    assert(entry.sequence === position + 1, 'index_sequence_gap');
    assert(MESSAGE_ID.test(entry.message_id) && !ids.has(entry.message_id), 'index_message_id_invalid');
    ids.add(entry.message_id);
    assert(entry.path === `messages/${String(entry.sequence).padStart(6, '0')}-${entry.message_id}.json`, 'index_message_path_invalid');
    assert(SHA256.test(entry.sha256), 'index_message_digest_invalid');
    assert(MESSAGE_TYPES.includes(entry.message_type), 'index_message_type_invalid');
    dateTime(entry.created_at, 'index_message_time_invalid');
    assert(LIFECYCLE_STATUSES.includes(entry.lifecycle_status), 'index_lifecycle_invalid');
    if (entry.supersedes_message_id !== null) {
      assert(ids.has(entry.supersedes_message_id) && entry.supersedes_message_id !== entry.message_id, 'index_supersession_invalid');
      assert(['correction', 'withdrawal'].includes(entry.message_type), 'index_supersession_type_invalid');
    }
    if (messages.has(entry.path)) {
      const stored = messages.get(entry.path);
      validatePairwiseMessage(stored.message);
      assert(stored.sha256 === entry.sha256, 'index_digest_mismatch');
      assert(stored.message.message_id === entry.message_id && stored.message.sequence === entry.sequence, 'index_message_metadata_mismatch');
      assert(stored.message.message_type === entry.message_type && stored.message.created_at === entry.created_at, 'index_message_metadata_mismatch');
      assert(stored.message.lifecycle.status === entry.lifecycle_status && stored.message.lifecycle.supersedes_message_id === entry.supersedes_message_id, 'index_lifecycle_mismatch');
    }
  }
  assert(index.next_sequence === index.messages.length + 1, 'index_next_sequence_invalid');
  if (messages.size) {
    assert(messages.size === index.messages.length, 'index_unindexed_message');
    for (const key of messages.keys()) assert(index.messages.some((entry) => entry.path === key), 'index_unindexed_message');
  }
  return index;
}

export function createEmptyChannel(options) {
  const manifest = {
    $schema: schemaUrl('pairwise-channel.schema.json'),
    schema_version: CHANNEL_SCHEMA_VERSION,
    protocol_version: PAIRWISE_PROTOCOL_VERSION,
    channel_version: options.channelVersion || '0.1.0',
    channel_id: options.channelId,
    publisher: { environment_id: options.publisherEnvironment, repository: options.publisherRepository },
    recipient: { environment_id: options.recipientEnvironment, reciprocal_repository: options.reciprocalRepository },
    authority: {
      repository_owner: repositoryOwner(options.publisherRepository),
      publisher_write: 'exclusive', recipient_access: 'read_only', recipient_mutations: [],
      response_location: 'recipient_outbound_repository'
    },
    message_path_pattern: 'messages/{sequence:6}-{message_id}.json',
    index_path: 'outbound/index.json', reader_state_location: 'reader_environment_only', created_at: options.createdAt
  };
  validateChannelManifest(manifest);
  const index = {
    $schema: schemaUrl('outbound-index.schema.json'), protocol_version: PAIRWISE_PROTOCOL_VERSION,
    channel_version: manifest.channel_version, channel_id: manifest.channel_id,
    publisher_repository: manifest.publisher.repository, next_sequence: 1, messages: []
  };
  validateOutboundIndex(index);
  return { manifest, index };
}

export async function initializeChannelRoot(outputRoot, options) {
  const entries = await readdir(outputRoot).catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error));
  assert(entries.length === 0, 'channel_output_not_empty');
  const channel = createEmptyChannel(options);
  await mkdir(path.join(outputRoot, 'channel'), { recursive: true });
  await mkdir(path.join(outputRoot, 'outbound'), { recursive: true });
  await writeFile(path.join(outputRoot, 'CHANNEL_VERSION'), `${channel.manifest.channel_version}\n`, { flag: 'wx' });
  await writeFile(path.join(outputRoot, 'channel', 'manifest.json'), prettyJson(channel.manifest), { flag: 'wx' });
  await writeFile(path.join(outputRoot, 'outbound', 'index.json'), prettyJson(channel.index), { flag: 'wx' });
  return channel;
}

async function messageFiles(root) {
  const directory = path.join(root, 'messages');
  const names = await readdir(directory).catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error));
  const result = new Map();
  for (const name of names.sort()) {
    assert(name.endsWith('.json'), 'channel_unexpected_message_file');
    const relative = `messages/${name}`;
    const buffer = await readFile(path.join(root, relative));
    result.set(relative, { message: JSON.parse(buffer.toString('utf8')), sha256: sha256(buffer) });
  }
  return result;
}

async function assertNoReaderState(root, relative = '') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git') continue;
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    assert(!/(?:reader[-_.]?(?:cache|cursor|state))/i.test(child), 'publisher_repository_contains_reader_state');
    if (entry.isDirectory()) await assertNoReaderState(root, child);
  }
}

export async function validateChannelRoot(root) {
  await assertNoReaderState(root);
  const manifest = validateChannelManifest(await readJson(path.join(root, 'channel', 'manifest.json')));
  const messages = await messageFiles(root);
  const index = validateOutboundIndex(await readJson(path.join(root, 'outbound', 'index.json')), messages);
  assert(index.channel_id === manifest.channel_id && index.channel_version === manifest.channel_version, 'channel_index_identity_mismatch');
  assert(index.publisher_repository === manifest.publisher.repository, 'channel_index_repository_mismatch');
  return { manifest, index, messages };
}

export async function proposeMessage(channelRoot, draft, proposalRoot) {
  const channel = await validateChannelRoot(channelRoot);
  validatePairwiseMessage(draft);
  assert(draft.sequence === channel.index.next_sequence, 'proposal_sequence_invalid');
  assert(draft.channel_id === channel.manifest.channel_id, 'proposal_channel_invalid');
  assert(draft.sender_environment === channel.manifest.publisher.environment_id, 'proposal_sender_not_publisher');
  assert(draft.recipient_environment === channel.manifest.recipient.environment_id, 'proposal_recipient_invalid');
  if (draft.lifecycle.supersedes_message_id !== null) assert(channel.index.messages.some((entry) => entry.message_id === draft.lifecycle.supersedes_message_id), 'proposal_supersedes_missing');
  const entries = await readdir(proposalRoot).catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error));
  assert(entries.length === 0, 'proposal_output_not_empty');
  const relative = messageRelativePath(draft);
  const serialized = prettyJson(draft);
  const entry = {
    sequence: draft.sequence, message_id: draft.message_id, path: relative, sha256: sha256(serialized),
    message_type: draft.message_type, created_at: draft.created_at, lifecycle_status: draft.lifecycle.status,
    supersedes_message_id: draft.lifecycle.supersedes_message_id
  };
  const index = { ...channel.index, next_sequence: channel.index.next_sequence + 1, messages: [...channel.index.messages, entry] };
  validateOutboundIndex(index);
  await mkdir(path.join(proposalRoot, 'messages'), { recursive: true });
  await mkdir(path.join(proposalRoot, 'outbound'), { recursive: true });
  await writeFile(path.join(proposalRoot, relative), serialized, { flag: 'wx' });
  await writeFile(path.join(proposalRoot, 'outbound', 'index.json'), prettyJson(index), { flag: 'wx' });
  return { message_path: relative, message_sha256: entry.sha256, index };
}

export function createAcknowledgementMessage(options) {
  validateCrossRepositoryReference(options.reference);
  const message = {
    $schema: schemaUrl('pairwise-message.schema.json'), protocol_version: PAIRWISE_PROTOCOL_VERSION,
    message_id: options.messageId, sequence: options.sequence, channel_id: options.channelId,
    sender_environment: options.senderEnvironment, recipient_environment: options.recipientEnvironment,
    message_type: options.messageType || 'acknowledgement', created_at: options.createdAt,
    content: { subject: options.subject, summary: options.summary, body: options.body || '' },
    payloads: [], references: [options.reference], acknowledgement_status: options.status,
    lifecycle: { status: 'published', supersedes_message_id: null }
  };
  return validatePairwiseMessage(message);
}

export function validateReaderCache(cache) {
  exactKeys(cache, ['$schema', 'protocol_version', 'channel_id', 'publisher_repository', 'last_commit', 'last_sequence', 'observed_at', 'processed'], 'reader_cache');
  assert(cache.$schema === schemaUrl('reader-cache.schema.json'), 'reader_cache_schema_invalid');
  assert(cache.protocol_version === PAIRWISE_PROTOCOL_VERSION && CHANNEL_ID.test(cache.channel_id), 'reader_cache_identity_invalid');
  assert(REPOSITORY.test(cache.publisher_repository) && SHA.test(cache.last_commit), 'reader_cache_source_invalid');
  assert(Number.isInteger(cache.last_sequence) && cache.last_sequence >= 0, 'reader_cache_sequence_invalid');
  dateTime(cache.observed_at, 'reader_cache_time_invalid');
  assert(Array.isArray(cache.processed), 'reader_cache_processed_invalid');
  cache.processed.forEach(validateCrossRepositoryReference);
  return cache;
}

export function deduplicateReferences(references) {
  const seen = new Set();
  const result = [];
  for (const reference of references) {
    validateCrossRepositoryReference(reference);
    const key = stableStringify(reference);
    if (!seen.has(key)) { seen.add(key); result.push(reference); }
  }
  return result;
}

export function evaluateReaderPermissions(permissions) {
  exactKeys(permissions, ['pull', 'push', 'admin', 'maintain', 'triage'], 'reader_permissions');
  const readOnly = permissions.pull === true && ['push', 'admin', 'maintain', 'triage'].every((key) => permissions[key] === false);
  return { status: readOnly ? 'READ_ONLY_VERIFIED' : 'READ_ONLY_NOT_VERIFIED', permissions: { ...permissions } };
}

export function validateWtbPayloadReference(payload, payloadBytes = null, schemaBytes = null) {
  validatePayload(payload);
  assert(payload.contract !== null, 'wtb_contract_required');
  if (payloadBytes !== null) assert(sha256(payloadBytes) === payload.sha256, 'wtb_payload_digest_mismatch');
  if (schemaBytes !== null) assert(sha256(schemaBytes) === payload.contract.schema_sha256, 'wtb_schema_digest_mismatch');
  return { transport: 'VALID', contract_reference: 'VALID', data_admission: 'NOT_ADMITTED' };
}
