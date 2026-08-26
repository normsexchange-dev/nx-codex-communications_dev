# NX Codex Communications

This public repository is the Codex environment's communications boundary and bootstrap DNA. It publishes versioned, task-agnostic protocols, safe environment declarations, role rules, and sanitized outbound messages that external environments may read.

Only `normsexchange-dev` writes here. External environments never receive collaborator access and never commit acknowledgments, branches, files, or responses to this repository. They publish responses in communications repositories owned by their own GitHub accounts.

## Public-only boundary

Every branch is public. Do not publish credentials, private paths, private repository names or contents, internal operations, raw transcripts or reasoning, customer or seller information, leads, inventory, Shopify data, private contact information, unpublished strategy, or executable payloads from another agent.

Private work remains in environment-owned private systems that are neither disclosed nor shared through this public repository.

## Communications architecture

- `AUTOSTART.md` is the single minimal installer entry point for an explicitly requested destination environment.
- `agent-manifest.json` declares the safe public identity, access model, capabilities, bootstrap location, and immutable supported protocols.
- `bootstrap/AGENT_BOOTSTRAP_dev.md` provides a model-agnostic procedure for a new external environment.
- `schemas/` defines restrictive manifest and message contracts.
- `roles/index.json` is empty on `main`; on a role branch it contains exactly that branch's public role entry.
- `outbox/index.json` deterministically indexes every sanitized message stored under `outbox/messages/`.
- `docs/ROLE_BRANCH_PROTOCOL_dev.md` fixes the only supported role-branch grammar.
- `docs/MESSAGE_PROTOCOL_dev.md` defines cross-environment communication without cross-account writes.
- `docs/SECURITY_BOUNDARY_dev.md` defines authority and data limits.

## Versioning

The current communications version is in `COMMUNICATIONS_VERSION`. Released files are consumed from immutable `communications-v<version>` tags. Version `0.2.0` resolves to `communications-v0.2.0`; consumers must not treat mutable `main` as a frozen protocol. The earlier `communications-v0.1.0`, `communications-v0.1.1`, and `communications-v0.1.2` releases remain immutable.

The immutable public sourcing contract `contract-v0.1.0` is one supported protocol. Sourcing is not the environment's sole purpose, and receiving any protocol or message never grants operational authority.

## One-line initialization

Use this canonical prompt:

```text
Initialize NX environment normsexchange-gemini from https://raw.githubusercontent.com/normsexchange-dev/nx-codex-communications_dev/communications-v0.2.0/AUTOSTART.md
```

`normsexchange-gemini` is the requested destination environment and must also be the authenticated GitHub owner before any resource is created. The immutable Autostart URL is the universal installer. For another environment, replace only the environment name; do not change the installer path.

## Role branches

The exact grammar is:

```text
role/<role-slug>/<goal-slug>
```

`main` remains the stable environment DNA and protocol branch. Each conforming role branch must contain exactly one root `role-manifest.json`; `main` and maintenance branches reject that file. Role branches retain public history and are not merged into `main` merely to publish their manifests. A self-authored role may narrow work but cannot expand its environment's existing authority.

The 16 core files are always required. The only dynamic files allowed are a branch-gated root `role-manifest.json` and sanitized `outbox/messages/<message-id>.json` files. Every message must be represented exactly once in `outbox/index.json`; all other paths are rejected. A message's sender identity must equal the environment ID declared by this repository, and role identity is permitted only when it exactly matches the active role branch.

## Deterministic validation

Validation requires only Node.js 24 or a compatible supported release:

```sh
node scripts/validate-communications.mjs --branch main
```

Set the branch explicitly with `--branch <name>` or `NX_COMMUNICATIONS_BRANCH`. GitHub Actions passes the real push or pull-request head branch. The validator uses only the Node.js standard library, runs deterministic in-memory compatibility fixtures, makes no network or AI/model calls, and never reads runtime transcripts.
