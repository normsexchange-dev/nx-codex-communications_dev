# Publisher-Owned Pairwise Channels

## One writer per repository

A private pairwise channel joins one publisher and one recipient. The repository owner is the sole publisher and owns message creation, sequencing, correction, supersession, withdrawal, retention, access, and Git history. The recipient may clone, fetch, inspect, validate, index, cite, cache, and respond, but may not push, branch, amend, delete, merge, acknowledge, or store reader state in the publisher repository.

The responder publishes acknowledgements and responses from its own outbound repository. Every response carries an immutable cross-repository reference containing the source owner, repository, exact 40-hex commit, exact path, message ID, SHA-256 digest, channel ID, and protocol version.

## Append-only lifecycle

The outbound index is sequential and append-only. A correction or withdrawal is a later message that references an earlier message ID. It never replaces the earlier file or rewrites Git history. A responder status is one of `received`, `validated`, `accepted`, `rejected`, `needs_information`, `superseded`, `withdrawn`, `incompatible`, or `unauthorized_boundary`.

Reader cursors, caches, deduplication sets, and locally derived indexes use `reader-cache.schema.json` and stay in the reader environment. They are never committed to the publisher channel.

## Public and private material

This public repository contains only task-agnostic schemas, tools, protocols, prompts, and synthetic examples. Actual assignments, research, candidate batches, private status, questions, responses, and acknowledgements belong only in the authorized private pairwise channel.

Transport validation proves format, sequence, digest, and reference integrity. Contract validation proves only the referenced payload contract. Neither operation admits a record into business data or grants sourcing, outreach, purchasing, listing, commerce, repository, or deployment authority.

## Access

The recipient must be mechanically read-only. If the hosting account cannot grant a user read-only access, use a selected-repository GitHub App with metadata read and contents read, no write permission, short-lived installation tokens, explicit revocation, and credentials stored only in the reader environment where they are used. Never describe a write-capable collaborator as read-only.

## Standard-library tools

- `initialize-pairwise-channel.mjs` creates an empty manifest and index in a new local directory.
- `validate-pairwise-channel.mjs` validates a local exact state.
- `propose-pairwise-message.mjs` writes a message and replacement index only to an empty local proposal directory.
- `create-pairwise-acknowledgement.mjs` proposes a response in the responder channel.
- `verify-reader-permission.mjs` reads the current token's repository permissions and fails unless only pull is granted.
- `consume-pairwise-channel.mjs` performs GitHub GET requests for one exact commit and writes only to a new reader-local directory.
- `validate-wtb-payload-reference.mjs` verifies the immutable contract release, schema, and content digests while returning `NOT_ADMITTED` for data admission.

None of these tools grants access, creates an invitation or credential, pushes to a repository, contacts a person, calls a model, admits business data, or changes Shopify.
