import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { assert, exactKeys, prettyJson, readJson, sha256 } from './nx-interface.mjs';

export const MESSAGE_STORE_PROTOCOL_VERSION = '0.8.0';
export const MESSAGE_STORE_SCHEMA_VERSION = '1.0.0';
export const INTERACTION_INTENTS = [
  'information', 'request', 'response', 'acknowledgement', 'lifecycle'
];
export const STORE_STATUSES = ['open', 'closed'];
export const DEFAULT_SUPPORTED_SEMANTICS = ['nx.message@1.0.0', 'nx.store.closed@1.0.0'];

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const ENVIRONMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GROUP = /^[a-z0-9]+(?:-[a-z0-9]+){0,7}$/;
const STORE_ID = /^store-[a-z0-9][a-z0-9-]{7,119}$/;
const MESSAGE_ID = /^msg-[a-z0-9][a-z0-9-]{15,79}$/;
const SEMANTIC_TYPE = /^[a-z][a-z0-9]*(?:\.[a-z0-9][a-z0-9-]*)+$/;
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MESSAGE_PATH = /^messages\/[0-9]{8}-msg-[a-z0-9][a-z0-9-]{15,79}\.json$/;

function dateTime(value, code) {
  assert(typeof value === 'string' && Number.isFinite(Date.parse(value)), code);
}

function boundedString(value, code, maximum = 4000, allowEmpty = false) {
  assert(typeof value === 'string' && value.length <= maximum, code);
  if (!allowEmpty) assert(value.trim().length > 0, code);
}

function safeRelative(value, code) {
  assert(typeof value === 'string' && value.length > 0 && !value.includes('\\'), code);
  assert(!path.posix.isAbsolute(value) && !value.split('/').includes('..'), code);
}

function repositoryOwner(repository) {
  return repository.split('/')[0];
}

export function candidateSchemaUrl(name) {
  return `https://raw.githubusercontent.com/normsexchange-dev/nx-codex-communications_dev/communications-v${MESSAGE_STORE_PROTOCOL_VERSION}/schemas/${name}`;
}

export function expectedRepository(publisherRepository, publisherEnvironment, groupId) {
  assert(REPOSITORY.test(publisherRepository), 'store_publisher_repository_invalid');
  assert(ENVIRONMENT.test(publisherEnvironment), 'store_publisher_environment_invalid');
  assert(GROUP.test(groupId), 'store_group_id_invalid');
  return `${repositoryOwner(publisherRepository)}/nx-msg-${publisherEnvironment}-${groupId}`;
}

export function expectedStoreId(publisherEnvironment, groupId) {
  return `store-${publisherEnvironment}-${groupId}`;
}

export function validateStoreManifest(manifest) {
  exactKeys(manifest, [
    '$schema', 'schema_version', 'protocol_version', 'store_id', 'group_id',
    'publisher', 'authority', 'delivery', 'message_path_pattern', 'index_path',
    'index_role', 'reader_state_location', 'created_at'
  ], 'message_store');
  assert(manifest.$schema === candidateSchemaUrl('message-store.schema.json'), 'store_schema_identity_invalid');
  assert(manifest.schema_version === MESSAGE_STORE_SCHEMA_VERSION, 'store_schema_version_invalid');
  assert(manifest.protocol_version === MESSAGE_STORE_PROTOCOL_VERSION, 'store_protocol_version_invalid');
  assert(STORE_ID.test(manifest.store_id), 'store_id_invalid');
  assert(GROUP.test(manifest.group_id), 'store_group_id_invalid');
  exactKeys(manifest.publisher, ['environment_id', 'repository'], 'store_publisher');
  assert(ENVIRONMENT.test(manifest.publisher.environment_id), 'store_publisher_environment_invalid');
  assert(REPOSITORY.test(manifest.publisher.repository), 'store_publisher_repository_invalid');
  assert(manifest.publisher.repository === expectedRepository(
    manifest.publisher.repository, manifest.publisher.environment_id, manifest.group_id
  ), 'store_repository_name_invalid');
  assert(manifest.store_id === expectedStoreId(manifest.publisher.environment_id, manifest.group_id), 'store_identity_mismatch');
  exactKeys(manifest.authority, [
    'publisher_write', 'reader_access', 'reader_mutations', 'response_location',
    'requests_confer_authority'
  ], 'store_authority');
  assert(manifest.authority.publisher_write === 'exclusive', 'store_publisher_not_exclusive');
  assert(manifest.authority.reader_access === 'repository_membership', 'store_reader_access_invalid');
  assert(Array.isArray(manifest.authority.reader_mutations) && manifest.authority.reader_mutations.length === 0, 'store_reader_mutations_present');
  assert(manifest.authority.response_location === 'reader_owned_publisher_store', 'store_response_location_invalid');
  assert(manifest.authority.requests_confer_authority === false, 'store_request_authority_invalid');
  exactKeys(manifest.delivery, [
    'mode', 'default_poll_seconds', 'minimum_poll_seconds', 'publisher_cadence'
  ], 'store_delivery');
  assert(manifest.delivery.mode === 'durable_pull', 'store_delivery_mode_invalid');
  assert(Number.isInteger(manifest.delivery.default_poll_seconds) && manifest.delivery.default_poll_seconds >= 60, 'store_default_poll_invalid');
  assert(Number.isInteger(manifest.delivery.minimum_poll_seconds) && manifest.delivery.minimum_poll_seconds >= 60, 'store_minimum_poll_invalid');
  assert(manifest.delivery.default_poll_seconds >= manifest.delivery.minimum_poll_seconds, 'store_poll_order_invalid');
  assert(manifest.delivery.publisher_cadence === 'advisory', 'store_publisher_cadence_invalid');
  assert(manifest.message_path_pattern === 'messages/{sequence:8}-{message_id}.json', 'store_message_pattern_invalid');
  assert(manifest.index_path === 'outbound/index.json', 'store_index_path_invalid');
  assert(manifest.index_role === 'derived_non_authoritative', 'store_index_role_invalid');
  assert(manifest.reader_state_location === 'reader_environment_only', 'store_reader_state_invalid');
  dateTime(manifest.created_at, 'store_created_at_invalid');
  return manifest;
}

function validateReference(reference) {
  exactKeys(reference, ['repository', 'commit', 'path', 'sha256', 'message_id'], 'store_message_reference');
  assert(REPOSITORY.test(reference.repository), 'store_reference_repository_invalid');
  assert(SHA.test(reference.commit), 'store_reference_commit_invalid');
  safeRelative(reference.path, 'store_reference_path_invalid');
  assert(SHA256.test(reference.sha256), 'store_reference_sha256_invalid');
  assert(reference.message_id === null || MESSAGE_ID.test(reference.message_id), 'store_reference_message_id_invalid');
}

export function validateStoreMessage(message) {
  exactKeys(message, [
    '$schema', 'protocol_version', 'message_id', 'sequence', 'store_id',
    'sender_environment', 'interaction_intent', 'semantic', 'created_at',
    'content', 'model_attention', 'references'
  ], 'message_store_message');
  assert(message.$schema === candidateSchemaUrl('message-store-message.schema.json'), 'store_message_schema_identity_invalid');
  assert(message.protocol_version === MESSAGE_STORE_PROTOCOL_VERSION, 'store_message_protocol_invalid');
  assert(MESSAGE_ID.test(message.message_id), 'store_message_id_invalid');
  assert(Number.isInteger(message.sequence) && message.sequence >= 1, 'store_message_sequence_invalid');
  assert(STORE_ID.test(message.store_id), 'store_message_store_id_invalid');
  assert(ENVIRONMENT.test(message.sender_environment), 'store_message_sender_invalid');
  assert(INTERACTION_INTENTS.includes(message.interaction_intent), 'store_message_intent_invalid');
  exactKeys(message.semantic, ['type', 'version'], 'store_message_semantic');
  assert(SEMANTIC_TYPE.test(message.semantic.type) && SEMVER.test(message.semantic.version), 'store_message_semantic_invalid');
  dateTime(message.created_at, 'store_message_time_invalid');
  exactKeys(message.content, ['subject', 'summary', 'body'], 'store_message_content');
  boundedString(message.content.subject, 'store_message_subject_invalid', 240);
  boundedString(message.content.summary, 'store_message_summary_invalid', 1000);
  boundedString(message.content.body, 'store_message_body_invalid', 20000, true);
  exactKeys(message.model_attention, ['classification', 'reason'], 'store_message_model_attention');
  assert(['status_only', 'candidate_action'].includes(message.model_attention.classification), 'store_message_model_classification_invalid');
  boundedString(message.model_attention.reason, 'store_message_model_reason_invalid', 500);
  if (message.model_attention.classification === 'candidate_action') {
    assert(['request', 'response'].includes(message.interaction_intent), 'store_message_candidate_action_intent_invalid');
  }
  assert(Array.isArray(message.references) && message.references.length <= 20, 'store_message_references_invalid');
  message.references.forEach(validateReference);
  if (message.semantic.type === 'nx.store.closed') {
    assert(message.semantic.version === '1.0.0', 'store_closure_semantic_version_invalid');
    assert(message.interaction_intent === 'lifecycle', 'store_closure_intent_invalid');
    assert(message.model_attention.classification === 'status_only', 'store_closure_model_attention_invalid');
  }
  return message;
}

export function messageRelativePath(message) {
  validateStoreMessage(message);
  return `messages/${String(message.sequence).padStart(8, '0')}-${message.message_id}.json`;
}

export function validateStoreIndex(index, messages = new Map()) {
  exactKeys(index, [
    '$schema', 'protocol_version', 'store_id', 'publisher_repository', 'next_sequence',
    'status', 'closed_at', 'closure_message_id', 'messages'
  ], 'message_store_index');
  assert(index.$schema === candidateSchemaUrl('message-store-index.schema.json'), 'store_index_schema_identity_invalid');
  assert(index.protocol_version === MESSAGE_STORE_PROTOCOL_VERSION, 'store_index_protocol_invalid');
  assert(STORE_ID.test(index.store_id) && REPOSITORY.test(index.publisher_repository), 'store_index_identity_invalid');
  assert(STORE_STATUSES.includes(index.status), 'store_index_status_invalid');
  assert(Array.isArray(index.messages), 'store_index_messages_invalid');
  const ids = new Set();
  for (const [position, entry] of index.messages.entries()) {
    exactKeys(entry, [
      'sequence', 'message_id', 'path', 'sha256', 'interaction_intent',
      'semantic_type', 'semantic_version', 'created_at'
    ], `store_index_message_${position}`);
    assert(entry.sequence === position + 1, 'store_index_sequence_gap');
    assert(MESSAGE_ID.test(entry.message_id) && !ids.has(entry.message_id), 'store_index_message_id_invalid');
    ids.add(entry.message_id);
    assert(entry.path === `messages/${String(entry.sequence).padStart(8, '0')}-${entry.message_id}.json`, 'store_index_message_path_invalid');
    assert(SHA256.test(entry.sha256), 'store_index_message_digest_invalid');
    assert(INTERACTION_INTENTS.includes(entry.interaction_intent), 'store_index_intent_invalid');
    assert(SEMANTIC_TYPE.test(entry.semantic_type) && SEMVER.test(entry.semantic_version), 'store_index_semantic_invalid');
    dateTime(entry.created_at, 'store_index_time_invalid');
    if (messages.has(entry.path)) {
      const stored = messages.get(entry.path);
      validateStoreMessage(stored.message);
      assert(stored.sha256 === entry.sha256, 'store_index_digest_mismatch');
      assert(stored.message.message_id === entry.message_id && stored.message.sequence === entry.sequence, 'store_index_message_metadata_mismatch');
      assert(stored.message.store_id === index.store_id, 'store_index_message_store_mismatch');
      assert(stored.message.interaction_intent === entry.interaction_intent, 'store_index_message_intent_mismatch');
      assert(stored.message.semantic.type === entry.semantic_type && stored.message.semantic.version === entry.semantic_version, 'store_index_message_semantic_mismatch');
    }
  }
  assert(index.next_sequence === index.messages.length + 1, 'store_index_next_sequence_invalid');
  if (messages.size) {
    assert(messages.size === index.messages.length, 'store_index_unindexed_message');
    for (const key of messages.keys()) assert(index.messages.some((entry) => entry.path === key), 'store_index_unindexed_message');
  }
  if (index.status === 'open') {
    assert(index.closed_at === null && index.closure_message_id === null, 'store_open_closure_present');
  } else {
    dateTime(index.closed_at, 'store_closed_at_invalid');
    assert(MESSAGE_ID.test(index.closure_message_id), 'store_closure_message_id_invalid');
    const final = index.messages.at(-1);
    assert(final?.message_id === index.closure_message_id && final.semantic_type === 'nx.store.closed', 'store_closure_not_final');
    assert(final.created_at === index.closed_at, 'store_closure_time_mismatch');
  }
  return index;
}

export function createEmptyStore(options) {
  const repository = expectedRepository(options.publisherRepository, options.publisherEnvironment, options.groupId);
  const manifest = {
    $schema: candidateSchemaUrl('message-store.schema.json'),
    schema_version: MESSAGE_STORE_SCHEMA_VERSION,
    protocol_version: MESSAGE_STORE_PROTOCOL_VERSION,
    store_id: expectedStoreId(options.publisherEnvironment, options.groupId),
    group_id: options.groupId,
    publisher: { environment_id: options.publisherEnvironment, repository },
    authority: {
      publisher_write: 'exclusive', reader_access: 'repository_membership',
      reader_mutations: [], response_location: 'reader_owned_publisher_store',
      requests_confer_authority: false
    },
    delivery: {
      mode: 'durable_pull', default_poll_seconds: options.defaultPollSeconds ?? 900,
      minimum_poll_seconds: 60, publisher_cadence: 'advisory'
    },
    message_path_pattern: 'messages/{sequence:8}-{message_id}.json',
    index_path: 'outbound/index.json', index_role: 'derived_non_authoritative',
    reader_state_location: 'reader_environment_only',
    created_at: options.createdAt
  };
  validateStoreManifest(manifest);
  const index = {
    $schema: candidateSchemaUrl('message-store-index.schema.json'),
    protocol_version: MESSAGE_STORE_PROTOCOL_VERSION, store_id: manifest.store_id,
    publisher_repository: repository, next_sequence: 1, status: 'open',
    closed_at: null, closure_message_id: null, messages: []
  };
  validateStoreIndex(index);
  return { manifest, index };
}

export async function initializeStoreRoot(outputRoot, options) {
  const entries = await readdir(outputRoot).catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error));
  assert(entries.length === 0, 'store_output_not_empty');
  const store = createEmptyStore(options);
  await mkdir(path.join(outputRoot, 'outbound'), { recursive: true });
  await writeFile(path.join(outputRoot, 'nx-message-store.json'), prettyJson(store.manifest), { flag: 'wx' });
  await writeFile(path.join(outputRoot, 'outbound', 'index.json'), prettyJson(store.index), { flag: 'wx' });
  return store;
}

async function messageFiles(root) {
  const directory = path.join(root, 'messages');
  const names = await readdir(directory).catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error));
  const result = new Map();
  for (const name of names.sort()) {
    assert(name.endsWith('.json'), 'store_unexpected_message_file');
    const relative = `messages/${name}`;
    assert(MESSAGE_PATH.test(relative), 'store_message_filename_invalid');
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
    assert(!/(?:reader[-_.]?(?:cache|cursor|state)|group[-_.]?navigation)/i.test(child), 'publisher_repository_contains_private_reader_state');
    if (entry.isDirectory()) await assertNoReaderState(root, child);
  }
}

export async function validateStoreRoot(root) {
  await assertNoReaderState(root);
  const manifest = validateStoreManifest(await readJson(path.join(root, 'nx-message-store.json')));
  const messages = await messageFiles(root);
  const derived = deriveStoreIndex(manifest, messages);
  const indexPath = path.join(root, manifest.index_path);
  const publishedIndex = await readJson(indexPath).catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error));
  const index = publishedIndex === null ? derived : validateStoreIndex(publishedIndex, messages);
  if (publishedIndex !== null) assert(JSON.stringify(index) === JSON.stringify(derived), 'store_derived_index_drift');
  assert(index.store_id === manifest.store_id, 'store_index_manifest_identity_mismatch');
  assert(index.publisher_repository === manifest.publisher.repository, 'store_index_repository_mismatch');
  for (const stored of messages.values()) assert(stored.message.sender_environment === manifest.publisher.environment_id, 'store_message_sender_not_publisher');
  return { manifest, index, messages };
}

export function deriveStoreIndex(manifest, messages) {
  validateStoreManifest(manifest);
  const entries = [];
  const ordered = [...messages.entries()].sort(([left], [right]) => left.localeCompare(right));
  for (const [position, [relative, stored]] of ordered.entries()) {
    const message = validateStoreMessage(stored.message);
    assert(message.sequence === position + 1, 'store_message_sequence_gap');
    assert(relative === messageRelativePath(message), 'store_message_path_content_mismatch');
    assert(message.store_id === manifest.store_id, 'store_message_store_mismatch');
    assert(message.sender_environment === manifest.publisher.environment_id, 'store_message_sender_not_publisher');
    if (message.semantic.type === 'nx.store.closed') assert(position === ordered.length - 1, 'store_closure_not_final');
    entries.push({
      sequence: message.sequence, message_id: message.message_id, path: relative,
      sha256: stored.sha256, interaction_intent: message.interaction_intent,
      semantic_type: message.semantic.type, semantic_version: message.semantic.version,
      created_at: message.created_at
    });
  }
  const final = entries.at(-1);
  const closed = final?.semantic_type === 'nx.store.closed';
  const index = {
    $schema: candidateSchemaUrl('message-store-index.schema.json'),
    protocol_version: MESSAGE_STORE_PROTOCOL_VERSION, store_id: manifest.store_id,
    publisher_repository: manifest.publisher.repository,
    next_sequence: entries.length + 1, status: closed ? 'closed' : 'open',
    closed_at: closed ? final.created_at : null,
    closure_message_id: closed ? final.message_id : null, messages: entries
  };
  return validateStoreIndex(index, messages);
}

export async function proposeStoreMessage(storeRoot, draft, proposalRoot) {
  const store = await validateStoreRoot(storeRoot);
  validateStoreMessage(draft);
  assert(store.index.status === 'open', 'store_is_closed');
  assert(draft.sequence === store.index.next_sequence, 'store_proposal_sequence_invalid');
  assert(draft.store_id === store.manifest.store_id, 'store_proposal_store_invalid');
  assert(draft.sender_environment === store.manifest.publisher.environment_id, 'store_proposal_sender_not_publisher');
  const entries = await readdir(proposalRoot).catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error));
  assert(entries.length === 0, 'store_proposal_output_not_empty');
  const relative = messageRelativePath(draft);
  const serialized = prettyJson(draft);
  const entry = {
    sequence: draft.sequence, message_id: draft.message_id, path: relative,
    sha256: sha256(serialized), interaction_intent: draft.interaction_intent,
    semantic_type: draft.semantic.type, semantic_version: draft.semantic.version,
    created_at: draft.created_at
  };
  const closing = draft.semantic.type === 'nx.store.closed';
  const index = {
    ...store.index,
    next_sequence: store.index.next_sequence + 1,
    status: closing ? 'closed' : 'open',
    closed_at: closing ? draft.created_at : null,
    closure_message_id: closing ? draft.message_id : null,
    messages: [...store.index.messages, entry]
  };
  validateStoreIndex(index);
  await mkdir(path.join(proposalRoot, 'messages'), { recursive: true });
  await mkdir(path.join(proposalRoot, 'outbound'), { recursive: true });
  await writeFile(path.join(proposalRoot, relative), serialized, { flag: 'wx' });
  await writeFile(path.join(proposalRoot, 'outbound', 'index.json'), prettyJson(index), { flag: 'wx' });
  return { message_path: relative, message_sha256: entry.sha256, index };
}

export async function applyStoreProposal(storeRoot, proposalRoot, authorityRef) {
  assert(typeof authorityRef === 'string' && authorityRef.trim(), 'store_apply_authority_reference_required');
  const store = await validateStoreRoot(storeRoot);
  const proposedIndex = validateStoreIndex(await readJson(path.join(proposalRoot, 'outbound', 'index.json')));
  assert(proposedIndex.store_id === store.index.store_id && proposedIndex.publisher_repository === store.index.publisher_repository, 'store_apply_identity_mismatch');
  assert(proposedIndex.messages.length === store.index.messages.length + 1, 'store_apply_not_single_append');
  assert(JSON.stringify(proposedIndex.messages.slice(0, -1)) === JSON.stringify(store.index.messages), 'store_apply_history_changed');
  const entry = proposedIndex.messages.at(-1);
  assert(entry.sequence === store.index.next_sequence, 'store_apply_sequence_invalid');
  const proposalBytes = await readFile(path.join(proposalRoot, entry.path));
  const message = validateStoreMessage(JSON.parse(proposalBytes.toString('utf8')));
  assert(sha256(proposalBytes) === entry.sha256, 'store_apply_proposal_digest_invalid');
  assert(message.message_id === entry.message_id && message.store_id === store.manifest.store_id, 'store_apply_message_identity_invalid');
  assert(message.sender_environment === store.manifest.publisher.environment_id, 'store_apply_sender_not_publisher');
  const combined = new Map(store.messages);
  combined.set(entry.path, { message, sha256: entry.sha256 });
  validateStoreIndex(proposedIndex, combined);
  await mkdir(path.join(storeRoot, 'messages'), { recursive: true });
  await mkdir(path.join(storeRoot, 'outbound'), { recursive: true });
  await writeFile(path.join(storeRoot, entry.path), proposalBytes, { flag: 'wx' });
  await writeFile(path.join(storeRoot, 'outbound', 'index.json'), prettyJson(proposedIndex));
  await validateStoreRoot(storeRoot);
  return { status: 'APPLIED_LOCAL_NOT_COMMITTED', message_path: entry.path, message_sha256: entry.sha256 };
}

export function validateReaderState(state) {
  exactKeys(state, [
    '$schema', 'protocol_version', 'store_id', 'publisher_repository',
    'last_sequence', 'observed_at', 'processed', 'parked'
  ], 'message_store_reader_state');
  assert(state.$schema === candidateSchemaUrl('reader-state-v0.8.schema.json'), 'store_reader_schema_identity_invalid');
  assert(state.protocol_version === MESSAGE_STORE_PROTOCOL_VERSION, 'store_reader_protocol_invalid');
  assert(STORE_ID.test(state.store_id) && REPOSITORY.test(state.publisher_repository), 'store_reader_identity_invalid');
  assert(Number.isInteger(state.last_sequence) && state.last_sequence >= 0, 'store_reader_sequence_invalid');
  dateTime(state.observed_at, 'store_reader_observed_at_invalid');
  assert(Array.isArray(state.processed) && Array.isArray(state.parked), 'store_reader_results_invalid');
  const seen = new Set();
  for (const [status, entries] of [['processed', state.processed], ['parked', state.parked]]) {
    for (const entry of entries) {
      const keys = status === 'processed'
        ? ['sequence', 'message_id', 'sha256', 'observed_at']
        : ['sequence', 'message_id', 'sha256', 'semantic_type', 'semantic_version', 'reason', 'observed_at'];
      exactKeys(entry, keys, `store_reader_${status}`);
      assert(Number.isInteger(entry.sequence) && entry.sequence >= 1 && entry.sequence <= state.last_sequence, 'store_reader_entry_sequence_invalid');
      assert(MESSAGE_ID.test(entry.message_id) && !seen.has(entry.message_id), 'store_reader_entry_id_invalid');
      seen.add(entry.message_id);
      assert(SHA256.test(entry.sha256), 'store_reader_entry_sha256_invalid');
      dateTime(entry.observed_at, 'store_reader_entry_time_invalid');
      if (status === 'parked') {
        assert(SEMANTIC_TYPE.test(entry.semantic_type) && SEMVER.test(entry.semantic_version), 'store_reader_parked_semantic_invalid');
        boundedString(entry.reason, 'store_reader_parked_reason_invalid', 500);
      }
    }
  }
  return state;
}

export function createReaderState(options) {
  const state = {
    $schema: candidateSchemaUrl('reader-state-v0.8.schema.json'),
    protocol_version: MESSAGE_STORE_PROTOCOL_VERSION, store_id: options.storeId,
    publisher_repository: options.publisherRepository, last_sequence: 0,
    observed_at: options.observedAt, processed: [], parked: []
  };
  return validateReaderState(state);
}

export async function scanStore(storeRoot, readerState, options) {
  const store = await validateStoreRoot(storeRoot);
  validateReaderState(readerState);
  assert(readerState.store_id === store.manifest.store_id, 'store_reader_store_mismatch');
  assert(readerState.publisher_repository === store.manifest.publisher.repository, 'store_reader_repository_mismatch');
  const supported = new Set(options.supportedSemantics ?? DEFAULT_SUPPORTED_SEMANTICS);
  const observedAt = options.observedAt;
  dateTime(observedAt, 'store_scan_observed_at_invalid');
  const next = structuredClone(readerState);
  next.observed_at = observedAt;
  const deliveries = [];
  for (const entry of store.index.messages.filter((item) => item.sequence > readerState.last_sequence)) {
    const message = store.messages.get(entry.path).message;
    const semantic = `${message.semantic.type}@${message.semantic.version}`;
    const common = {
      sequence: entry.sequence, message_id: entry.message_id,
      sha256: entry.sha256, observed_at: observedAt
    };
    if (supported.has(semantic)) {
      next.processed.push(common);
      deliveries.push({
        status: 'TRANSPORT_VALIDATED', path: entry.path, message,
        reference_verification: message.references.length ? 'UNVERIFIED_NOT_FETCHED' : 'NOT_APPLICABLE',
        model_admission: 'NOT_EVALUATED'
      });
    } else {
      next.parked.push({
        ...common, semantic_type: message.semantic.type,
        semantic_version: message.semantic.version,
        reason: 'unsupported_semantic_retained_for_replay'
      });
      deliveries.push({
        status: 'PARKED_UNSUPPORTED_SEMANTIC', path: entry.path, message,
        reference_verification: message.references.length ? 'UNVERIFIED_NOT_FETCHED' : 'NOT_APPLICABLE',
        model_admission: 'NOT_ELIGIBLE'
      });
    }
    next.last_sequence = entry.sequence;
  }
  validateReaderState(next);
  return { state: next, deliveries };
}

export async function replayParked(storeRoot, readerState, options) {
  const store = await validateStoreRoot(storeRoot);
  validateReaderState(readerState);
  assert(readerState.store_id === store.manifest.store_id, 'store_reader_store_mismatch');
  assert(readerState.publisher_repository === store.manifest.publisher.repository, 'store_reader_repository_mismatch');
  const supported = new Set(options.supportedSemantics ?? DEFAULT_SUPPORTED_SEMANTICS);
  const observedAt = options.observedAt;
  dateTime(observedAt, 'store_replay_observed_at_invalid');
  const next = structuredClone(readerState);
  next.observed_at = observedAt;
  const retained = [];
  const deliveries = [];
  for (const parked of next.parked) {
    const semantic = `${parked.semantic_type}@${parked.semantic_version}`;
    if (!supported.has(semantic)) {
      retained.push(parked);
      continue;
    }
    const indexEntry = store.index.messages.find((entry) =>
      entry.sequence === parked.sequence && entry.message_id === parked.message_id && entry.sha256 === parked.sha256
    );
    assert(indexEntry, 'store_parked_replay_source_mismatch');
    const message = store.messages.get(indexEntry.path).message;
    next.processed.push({
      sequence: parked.sequence, message_id: parked.message_id,
      sha256: parked.sha256, observed_at: observedAt
    });
    deliveries.push({
      status: 'REPLAYED_TRANSPORT_VALIDATED', path: indexEntry.path, message,
      reference_verification: message.references.length ? 'UNVERIFIED_NOT_FETCHED' : 'NOT_APPLICABLE',
      model_admission: 'NOT_EVALUATED'
    });
  }
  next.parked = retained;
  next.processed.sort((left, right) => left.sequence - right.sequence);
  validateReaderState(next);
  return { state: next, deliveries };
}

export function evaluateUsageGate(input) {
  exactKeys(input, [
    'actionable', 'semantic_supported', 'authority_verified',
    'automatic_execution_enabled', 'usage_known', 'remaining_percent',
    'reserve_percent', 'safety_margin_percent'
  ], 'message_store_usage_gate');
  if (!input.automatic_execution_enabled) return { admitted: false, status: 'STATUS_ONLY_AUTOMATIC_EXECUTION_DISABLED' };
  if (!input.actionable) return { admitted: false, status: 'STATUS_ONLY_NOT_ACTIONABLE' };
  if (!input.semantic_supported) return { admitted: false, status: 'STATUS_ONLY_UNSUPPORTED_SEMANTIC' };
  if (!input.authority_verified) return { admitted: false, status: 'STATUS_ONLY_AUTHORITY_NOT_VERIFIED' };
  if (!input.usage_known) return { admitted: false, status: 'STATUS_ONLY_UNKNOWN_USAGE' };
  for (const key of ['remaining_percent', 'reserve_percent', 'safety_margin_percent']) {
    assert(Number.isFinite(input[key]) && input[key] >= 0 && input[key] <= 100, `message_store_usage_${key}_invalid`);
  }
  if (input.remaining_percent <= input.reserve_percent + input.safety_margin_percent) {
    return { admitted: false, status: 'STATUS_ONLY_USAGE_RESERVE' };
  }
  return { admitted: true, status: 'ELIGIBLE_AFTER_ALL_LOCAL_GATES' };
}
