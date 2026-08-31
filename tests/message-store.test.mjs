import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { prettyJson } from '../scripts/lib/nx-interface.mjs';
import {
  applyStoreProposal, candidateSchemaUrl, createReaderState, evaluateUsageGate, initializeStoreRoot,
  proposeStoreMessage, replayParked, scanStore, validateStoreManifest, validateStoreMessage,
  validateStoreRoot
} from '../scripts/lib/message-store.mjs';

const CREATED = '2026-08-30T20:00:00.000Z';
const OWNER_REPOSITORY = 'example-owner/nx-msg-reference-a-reference';
const STORE_ID = 'store-reference-a-reference';

function draft(sequence, options = {}) {
  const semanticType = options.semanticType || 'nx.message';
  const intent = options.intent || 'information';
  return {
    $schema: candidateSchemaUrl('message-store-message.schema.json'),
    protocol_version: '0.8.0',
    message_id: options.messageId || `msg-reference-a-${String(sequence).padStart(8, '0')}`,
    sequence, store_id: STORE_ID, sender_environment: 'reference-a',
    interaction_intent: intent,
    semantic: { type: semanticType, version: options.semanticVersion || '1.0.0' },
    created_at: options.createdAt || `2026-08-30T20:0${sequence}:00.000Z`,
    content: {
      subject: options.subject || `Reference message ${sequence}`,
      summary: options.summary || 'Deterministic candidate fixture.',
      body: options.body || ''
    },
    model_attention: {
      classification: options.modelAttention || 'status_only',
      reason: options.modelReason || 'Reference validation does not require a model.'
    },
    references: []
  };
}

async function createRoot(t) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'nx-message-store-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const root = path.join(temp, 'store');
  await initializeStoreRoot(root, {
    groupId: 'reference', publisherEnvironment: 'reference-a',
    publisherRepository: OWNER_REPOSITORY, createdAt: CREATED
  });
  return { temp, root };
}

async function publish(root, temp, message) {
  const proposal = path.join(temp, `proposal-${path.basename(root)}-${message.sequence}`);
  const result = await proposeStoreMessage(root, message, proposal);
  await applyStoreProposal(root, proposal, 'fictional-test-authority');
  return result;
}

test('candidate store derives one publisher-owned repository and exposes no recipient field', async () => {
  const manifest = validateStoreManifest({
    $schema: candidateSchemaUrl('message-store.schema.json'),
    schema_version: '1.0.0', protocol_version: '0.8.0', store_id: STORE_ID,
    group_id: 'reference',
    publisher: { environment_id: 'reference-a', repository: OWNER_REPOSITORY },
    authority: {
      publisher_write: 'exclusive', reader_access: 'repository_membership',
      reader_mutations: [], response_location: 'reader_owned_publisher_store',
      requests_confer_authority: false
    },
    delivery: {
      mode: 'durable_pull', default_poll_seconds: 900,
      minimum_poll_seconds: 60, publisher_cadence: 'advisory'
    },
    message_path_pattern: 'messages/{sequence:8}-{message_id}.json',
    index_path: 'outbound/index.json', index_role: 'derived_non_authoritative',
    reader_state_location: 'reader_environment_only',
    created_at: CREATED
  });
  assert.equal(manifest.publisher.repository, OWNER_REPOSITORY);
  assert.equal(JSON.stringify(manifest).includes('recipient'), false);
  assert.throws(() => validateStoreManifest({ ...manifest, recipient: 'reference-b' }), /store_fields_invalid/);
  assert.throws(() => validateStoreManifest({
    ...manifest, group_id: 'Reference'
  }), /store_group_id_invalid/);
  assert.throws(() => validateStoreManifest({
    ...manifest, publisher: { ...manifest.publisher, repository: 'example-owner/custom-name' }
  }), /store_repository_name_invalid/);
  assert.throws(() => validateStoreManifest({
    ...manifest, delivery: { ...manifest.delivery, minimum_poll_seconds: 30 }
  }), /store_minimum_poll_invalid/);
});

test('message paths are authoritative and the derived index is rebuildable', async (t) => {
  const { temp, root } = await createRoot(t);
  await publish(root, temp, draft(1));
  await unlink(path.join(root, 'outbound', 'index.json'));
  const rebuilt = await validateStoreRoot(root);
  assert.equal(rebuilt.index.messages.length, 1);
  assert.equal(rebuilt.index.next_sequence, 2);
  assert.equal(rebuilt.manifest.index_role, 'derived_non_authoritative');
});

test('local proposal application requires an explicit authority reference and never publishes', async (t) => {
  const { temp, root } = await createRoot(t);
  const proposal = path.join(temp, 'proposal-authority-check');
  await proposeStoreMessage(root, draft(1), proposal);
  await assert.rejects(applyStoreProposal(root, proposal, ''), /store_apply_authority_reference_required/);
  const applied = await applyStoreProposal(root, proposal, 'fictional-owner-decision');
  assert.equal(applied.status, 'APPLIED_LOCAL_NOT_COMMITTED');
  assert.equal((await validateStoreRoot(root)).index.messages.length, 1);
});

test('group navigation schema is private local topology and contains no membership authority', async () => {
  const schema = JSON.parse(await readFile(new URL('../schemas/group-navigation.schema.json', import.meta.url), 'utf8'));
  assert.match(schema.description, /reader-local state/);
  assert.match(schema.description, /MUST NOT be published/);
  assert.deepEqual(schema.required, ['schema_version', 'environment_id', 'groups']);
  assert.equal('members' in schema.properties, false);
  assert.equal('recipients' in schema.properties, false);
});

test('unknown semantics park without blocking later messages and replay is idempotent', async (t) => {
  const { temp, root } = await createRoot(t);
  await publish(root, temp, draft(1));
  await publish(root, temp, draft(2, {
    semanticType: 'example.future', semanticVersion: '9.0.0',
    subject: 'Unknown semantic', summary: 'Retain this for a future adapter.'
  }));
  await publish(root, temp, draft(3, {
    intent: 'request', modelAttention: 'candidate_action',
    subject: 'Supported request', summary: 'This remains data until local authority and usage gates pass.'
  }));

  const reader = createReaderState({
    storeId: STORE_ID, publisherRepository: OWNER_REPOSITORY, observedAt: CREATED
  });
  const first = await scanStore(root, reader, { observedAt: '2026-08-30T20:10:00.000Z' });
  assert.deepEqual(first.deliveries.map((item) => item.status), [
    'TRANSPORT_VALIDATED', 'PARKED_UNSUPPORTED_SEMANTIC', 'TRANSPORT_VALIDATED'
  ]);
  assert.equal(first.state.last_sequence, 3);
  assert.deepEqual(first.state.processed.map((item) => item.sequence), [1, 3]);
  assert.deepEqual(first.state.parked.map((item) => item.sequence), [2]);

  const newlySupported = await replayParked(root, first.state, {
    observedAt: '2026-08-30T20:10:30.000Z',
    supportedSemantics: ['nx.message@1.0.0', 'nx.store.closed@1.0.0', 'example.future@9.0.0']
  });
  assert.deepEqual(newlySupported.deliveries.map((item) => item.status), ['REPLAYED_TRANSPORT_VALIDATED']);
  assert.deepEqual(newlySupported.state.processed.map((item) => item.sequence), [1, 2, 3]);
  assert.equal(newlySupported.state.parked.length, 0);

  const replay = await scanStore(root, first.state, { observedAt: '2026-08-30T20:11:00.000Z' });
  assert.equal(replay.deliveries.length, 0);
  assert.equal(replay.state.last_sequence, 3);
});

test('a multi-year offline gap resumes from the durable cursor without delivery loss', async (t) => {
  const { temp, root } = await createRoot(t);
  await publish(root, temp, draft(1));
  const reader = createReaderState({
    storeId: STORE_ID, publisherRepository: OWNER_REPOSITORY, observedAt: CREATED
  });
  const first = await scanStore(root, reader, { observedAt: '2026-08-30T20:10:00.000Z' });
  await publish(root, temp, draft(2, { createdAt: '2030-08-30T20:02:00.000Z' }));
  const resumed = await scanStore(root, first.state, { observedAt: '2030-08-30T20:10:00.000Z' });
  assert.deepEqual(resumed.deliveries.map((item) => item.message.sequence), [2]);
  assert.equal(resumed.state.last_sequence, 2);
});

test('two publisher stores stage a responder-owned exchange without claiming reference access', async (t) => {
  const { temp, root: rootA } = await createRoot(t);
  const rootB = path.join(temp, 'store-b');
  const repositoryB = 'example-owner/nx-msg-reference-b-reference';
  const storeB = 'store-reference-b-reference';
  await initializeStoreRoot(rootB, {
    groupId: 'reference', publisherEnvironment: 'reference-b',
    publisherRepository: repositoryB, createdAt: CREATED
  });

  const source = draft(1);
  const publishedA = await publish(rootA, temp, source);
  const response = {
    ...draft(1, {
      intent: 'acknowledgement', messageId: 'msg-reference-b-00000001',
      subject: 'Reference acknowledgement', summary: 'Published only in B-owned storage.'
    }),
    store_id: storeB,
    sender_environment: 'reference-b',
    references: [{
      repository: OWNER_REPOSITORY, commit: 'a'.repeat(40),
      path: publishedA.message_path, sha256: publishedA.message_sha256,
      message_id: source.message_id
    }]
  };
  await publish(rootB, temp, response);
  const validatedA = await validateStoreRoot(rootA);
  const validatedB = await validateStoreRoot(rootB);
  assert.equal(validatedA.index.messages.length, 1);
  assert.equal(validatedB.index.messages.length, 1);
  assert.equal(validatedB.messages.values().next().value.message.sender_environment, 'reference-b');

  const reader = createReaderState({
    storeId: storeB, publisherRepository: repositoryB, observedAt: CREATED
  });
  const scan = await scanStore(rootB, reader, { observedAt: '2026-08-30T20:12:00.000Z' });
  assert.equal(scan.deliveries[0].status, 'TRANSPORT_VALIDATED');
  assert.equal(scan.deliveries[0].reference_verification, 'UNVERIFIED_NOT_FETCHED');
  assert.equal(scan.deliveries[0].model_admission, 'NOT_EVALUATED');
});

test('usage gate never admits while automatic execution is disabled', () => {
  const baseline = {
    actionable: true, semantic_supported: true, authority_verified: true,
    automatic_execution_enabled: false, usage_known: true, remaining_percent: 90,
    reserve_percent: 50, safety_margin_percent: 5
  };
  assert.deepEqual(evaluateUsageGate(baseline), {
    admitted: false, status: 'STATUS_ONLY_AUTOMATIC_EXECUTION_DISABLED'
  });
  assert.deepEqual(evaluateUsageGate({ ...baseline, automatic_execution_enabled: true, usage_known: false }), {
    admitted: false, status: 'STATUS_ONLY_UNKNOWN_USAGE'
  });
  assert.deepEqual(evaluateUsageGate({ ...baseline, automatic_execution_enabled: true }), {
    admitted: true, status: 'ELIGIBLE_AFTER_ALL_LOCAL_GATES'
  });
});

test('a request is a candidate message and cannot declare authority', () => {
  const message = validateStoreMessage(draft(1, {
    intent: 'request', modelAttention: 'candidate_action',
    modelReason: 'The reader must decide whether this is actionable.'
  }));
  assert.equal('authority' in message, false);
  assert.throws(() => validateStoreMessage({ ...message, authority: 'granted' }), /message_store_message_fields_invalid/);
});

test('closure is the final append and later proposals fail', async (t) => {
  const { temp, root } = await createRoot(t);
  await publish(root, temp, draft(1));
  await publish(root, temp, draft(2, {
    semanticType: 'nx.store.closed', intent: 'lifecycle',
    messageId: 'msg-reference-close-00000002', subject: 'Store closed',
    summary: 'No later messages may be added.'
  }));
  const validated = await validateStoreRoot(root);
  assert.equal(validated.index.status, 'closed');
  await assert.rejects(
    proposeStoreMessage(root, draft(3), path.join(temp, 'proposal-after-close')),
    /store_is_closed/
  );
});

test('digest mutation and publisher-side reader state fail closed', async (t) => {
  const { temp, root } = await createRoot(t);
  const published = await publish(root, temp, draft(1));
  const messagePath = path.join(root, published.message_path);
  const message = JSON.parse(await readFile(messagePath, 'utf8'));
  message.content.body = 'tampered';
  await writeFile(messagePath, prettyJson(message));
  await assert.rejects(validateStoreRoot(root), /store_index_digest_mismatch/);

  await writeFile(messagePath, await readFile(path.join(temp, 'proposal-store-1', published.message_path)));
  await writeFile(path.join(root, 'reader-state.json'), '{}\n');
  await assert.rejects(validateStoreRoot(root), /publisher_repository_contains_private_reader_state/);
});

test('candidate implementation has no network or model invocation surface', async () => {
  const source = await readFile(new URL('../scripts/lib/message-store.mjs', import.meta.url), 'utf8');
  assert.equal(/node:https|\bfetch\s*\(|OpenAI|generateContent|model\.generate/i.test(source), false);
});
