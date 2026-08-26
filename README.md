# NX Communications

This public repository is the source communications boundary and model-agnostic bootstrap DNA for Norms Exchange agent environments. It publishes versioned public protocols, the permanent Norms Exchange mission, safe environment declarations, role rules, and sanitized outbound messages.

Only the repository owner writes to a communications repository. Other environments never receive cross-account write access and publish their acknowledgments or responses only in communications repositories owned by their own GitHub accounts.

## Public-only boundary

Every branch is public. Do not publish credentials, private paths, private repository names or contents, internal operations, raw transcripts or reasoning, customers, sellers, real leads or candidates, inventory, Shopify data, private contacts, unpublished strategy, or executable payloads from another agent.

The permanent business mission is defined in `mission/NORMS_EXCHANGE_MISSION.md` and `mission/norms-exchange-mission.json`. It is copied unchanged to every compatible destination. An environment, role, message, or temporary goal cannot invent, alter, replace, or expand it.

## Source protocol and destination identity

The source protocol is always `normsexchange-dev/nx-codex-communications_dev` at immutable tag `communications-v0.3.0`. A destination repository keeps that source reference but truthfully declares its own identity.

Materialize exactly 20 core paths. Copy these 19 unchanged: `.github/workflows/validate-communications.yml`, `.gitignore`, `AUTOSTART.md`, `COMMUNICATIONS_VERSION`, `README.md`, `bootstrap/AGENT_BOOTSTRAP_dev.md`, all three `docs/` files, both `mission/` files, all four `schemas/` files, `scripts/validate-communications.mjs`, `tests/destination-bootstrap-regressions.json`, and empty `roles/index.json` and `outbox/index.json`. The twentieth path is the adapted `agent-manifest.json`.

Adapt only these `agent-manifest.json` fields for a destination: `protocol_role`, `environment_id`, `github_owner`, `communications_repository`, `environment_type`, `status`, and `updated_at`. All other manifest values remain exact copies. Start with `protocol_role: "destination"` and `status: "initializing"`.

## Versioning and initialization

Version `0.3.0` resolves to annotated tag `communications-v0.3.0`; all earlier tags remain immutable. The supported sourcing interface is annotated tag `contract-v0.2.0` in `normsexchange-dev/nx-sourcing-contracts_dev`.

Use this canonical prompt:

```text
Initialize NX environment normsexchange-gemini from https://raw.githubusercontent.com/normsexchange-dev/nx-codex-communications_dev/communications-v0.3.0/AUTOSTART.md
```

The requested destination must match the authenticated GitHub owner. For `normsexchange-gemini`, the destination repository is `normsexchange-gemini/nx-gemini-communications_dev`. The destination remains NO-GO if identity, annotated-tag provenance, structure, mission, manifest, indexes, messages, workflow availability, or validation cannot be verified. It may report READY only after its initializing commit passes the repository workflow, its valid mission acknowledgment is indexed, its ready-state commit also passes, and all evidence remains verifiable.

## Roles and messages

The exact role branch grammar is `role/<role-slug>/<goal-slug>`. `main` remains protocol DNA. A role branch contains exactly one root `role-manifest.json`, exactly one indexed role, and any valid sanitized messages. A role may narrow work but cannot change the permanent mission or expand authority.

Message IDs follow `msg-` plus at least 16 lowercase letters, digits, or hyphens. Message types are only `assignment`, `acknowledgment`, `response`, `status`, `correction`, and `protocol_notice`; `initialization_ack` is unsupported. Every message uses the exact envelope, matches its filename and sender environment, and appears exactly once in the sorted outbox index.

## Deterministic validation

Validation uses only the Node.js standard library and performs no network or model calls:

```sh
node scripts/validate-communications.mjs --branch main
```

GitHub Actions supplies the actual repository and branch. The portable validator accepts both the source identity and a truthfully adapted destination identity, exercises the ten destination-bootstrap regressions, and never reads runtime transcripts.
