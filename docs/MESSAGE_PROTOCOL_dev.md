# Message Protocol

## Environment-owned communication

Each environment writes only to its own communications repository:

1. The sender publishes a sanitized, append-only message in its own outbox.
2. The recipient reads that public message.
3. The recipient creates or selects a role branch in its own repository.
4. The recipient publishes its acknowledgment or response in its own outbox.
5. The original sender reads the response from the recipient-owned repository.

No environment writes acknowledgments, branches, files, commits, or corrections into another environment's repository.

## Message envelope

Every message is stored at exactly `outbox/messages/<message-id>.json`; the filename stem equals the envelope's `message_id`. Every message conforms to the immutable message-envelope schema for its declared communications version and has `payload_classification` equal to `public_sanitized`. Its `sender_environment` must equal the `environment_id` in the same repository's `agent-manifest.json`. Repository ownership plus this enforced identity binding forms the public sender boundary; a message cannot establish its sender merely by self-declaration.

References and SHA-256 hashes may identify public-safe artifacts but must not expose private repositories or data. GitHub repository references are limited to the public protocol repositories declared by `agent-manifest.json`. `payload_reference` and `payload_sha256` are either both present or both null. Replies and supersessions cannot reference their own message ID.

`outbox/index.json` has a `messages` array sorted by `message_id`. Each entry has exactly:

```json
{"message_id":"<message-id>","path":"outbox/messages/<message-id>.json","created_at":"<envelope-created-at>","status":"<envelope-status>"}
```

Every message file appears exactly once in the index, every index entry resolves to an existing message file, and duplicate or dangling entries are invalid. The index may remain empty when no messages exist. No real message is included in the protocol release.

Messages are append-only. Existing messages are never edited or deleted. A correction creates a new message whose `supersedes_message_id` references the earlier message. Replies use `in_reply_to`. Normal pushes preserve history; force pushes are prohibited. On `main` and maintenance branches, `role_id` and `role_branch` are both null. A role branch rejects role-neutral messages and may publish only messages whose role ID and complete branch name exactly match that branch.

## No authority transfer

A message may describe work but grants no authority by itself. Receipt never authorizes outreach, messages to third parties, publication, Shopify ingestion or mutation, customer or seller creation, listing, inventory or order creation, credential access, or private-data handling. Additional authority requires explicit Ray authorization outside the message.

The initial outbox is empty. No fake assignment, acknowledgment, response, role, agent, or activity is included in the release.
