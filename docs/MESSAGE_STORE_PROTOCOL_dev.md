# NX Message Store Protocol — 0.8.0 Candidate

Status: development candidate. The immutable released communications version remains `communications-v0.7.0`. No `communications-v0.8.0` tag or public reference store is claimed by this document.

## Purpose

The message-store protocol lets a selected group of sovereign environments exchange durable messages through repositories without a central broker. It generalizes the 0.7 pairwise channel while preserving its strongest property: one publisher is the only writer to each outbound repository.

The protocol is transport and platform neutral. GitHub can host a store, but GitHub is not part of the message format. A conforming adapter may use another repository service if it preserves immutable commit identity, ordered paths, repository-level access, and single-writer enforcement.

## Repository and ownership model

Each publisher/group combination has one repository:

```text
nx-msg-<publisher-environment-id>-<group-id>
```

The repository root contains `nx-message-store.json`, append-only message files, and an optional publisher-maintained `outbound/index.json`:

```text
messages/00000001-msg-<stable-id>.json
```

Lexically ordered message paths are authoritative. The index is a derived, non-authoritative acceleration structure that may be rebuilt from path enumeration. If present, it must match every enumerated path, digest, semantic type, and lifecycle value exactly or validation fails.

The publisher environment is the sole writer. Readers have repository-level read access and do not acknowledge, respond, or write reader state inside the publisher's store. A response belongs in the responding environment's own store for the same group.

Group membership is repository membership. There is no recipient roster or per-message privacy in the protocol. If two readers can read a store, both can read every message in it. Create separate groups when visibility must differ.

On GitHub, an ordinary collaborator on a private repository owned by a personal account is write-capable and does not satisfy this reader boundary. Suitable mechanisms include a read-only deploy key, a selected-repository GitHub App with metadata/contents read and no write, organization-level read permission, or an equivalent future-host control. The message protocol does not prove the access roster or its history.

Private group navigation—what groups an environment has joined and which stores it follows—stays in environment-local state governed by `group-navigation.schema.json`. It must not be published into a store or a public reserved `.nx/` surface.

## Delivery and cadence

Delivery is durable pull. The default reader interval is 900 seconds and the minimum declared interval is 60 seconds. Polling cadence and publisher cadence are advisory; neither is a delivery guarantee. Readers should use conditional repository requests or commit comparison when their adapter supports them.

This candidate does not start a service, schedule a reader, invoke a model, or create credentials. An adapter must separately prove those runtime capabilities.

## Message meaning

Every message declares an interaction intent:

- `information`
- `request`
- `response`
- `acknowledgement`
- `lifecycle`

It also declares a versioned semantic type. Core candidate semantics are `nx.message@1.0.0` and `nx.store.closed@1.0.0`.

A request is data, not authority. `model_attention.classification: candidate_action` is only a publisher hint. The reader must independently verify scope, credentials, policy, human authority, and usage before any external action or model invocation.

## Unknown semantics and inaccessible references

A valid message with an unsupported semantic type is retained in the reader's `parked` list. The reader advances past it and continues scanning later sequence numbers. When support is added, `replayParked` revalidates the immutable path and digest, moves the record to processed state, and produces a replay delivery without invoking a model.

Cross-repository references identify a repository, commit, path, and SHA-256. Failure to access or verify a reference does not make its claims true or false. The reader records it as unverified and defers any action that depends on it. A missing credential is not a reason to request or expose one in a message.

An exact repository commit proves content identity, not the real-world identity of whoever controlled the account. Account or host compromise can violate the writer boundary. Independent message signatures and controller-key revocation remain an unsolved future design question, not a candidate claim.

## Cursor, replay, and idempotency

Reader state is local to the reader. It records the highest observed sequence and the digest of each processed or parked message. Re-reading an unchanged store produces no new deliveries. A digest or index mismatch fails validation instead of silently replaying modified content.

Adapters should save reader state atomically after validation. If state is lost, replay from sequence one is safe for inspection, but an action layer must use the message ID and digest as an idempotency key before performing an external effect.

## Closure

Closure is an append-only lifecycle event. The final message uses `interaction_intent: lifecycle` and `nx.store.closed@1.0.0`. The index then records `closed`, the final message ID, and its time. No later message may be appended, and a closed store is never reopened. A new conversation uses a new group/store identity.

## Usage and model gate

The candidate reader validates and classifies without calling a model. `evaluateUsageGate` returns status only. Eligibility requires all of the following:

1. automatic execution was explicitly enabled by a separate environment authority;
2. the message is locally judged actionable;
3. its semantic version is supported;
4. action authority is independently verified;
5. remaining usage is known; and
6. remaining usage exceeds the configured reserve plus safety margin.

With automatic execution disabled—the default in this repository—the result is always `STATUS_ONLY_AUTOMATIC_EXECUTION_DISABLED`.

## Relationship to A2A

NX message stores and the A2A protocol solve adjacent problems. Message stores provide repository-native durable exchange, sovereign ownership, and offline audit history. A2A provides network discovery, Agent Cards, task interaction, and standard bindings. This candidate does not implement A2A and does not advertise an Agent Card. A later adapter could reference message-store capabilities from an A2A surface without replacing either protocol.

## Security invariants

- One writer per store.
- Repository-level visibility only; no per-message secrecy claim.
- Reader state and group topology remain local.
- Requests and publisher hints confer no authority.
- No credential values in stores, schemas, logs, tests, or prompts.
- No model or external action in validation tools.
- All repository mutations remain proposals until separately authorized and published by the store owner.
