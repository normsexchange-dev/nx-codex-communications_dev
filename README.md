# NX Communications

This public repository is the task-agnostic communications and bootstrap protocol for Norms Exchange external environments. It contains no private repository topology, credentials, operational records, sourcing workspace, marketplace records, or authority to contact people or mutate Shopify.

The permanent mission remains unchanged: Norms Exchange is a professional movie-production equipment marketplace for governed WTS and WTB workflows, with Norms review, an initial Los Angeles/United States-to-Vietnam corridor, public evidence, and no fabricated activity or unauthorized outreach or Shopify changes.

## Immutable release and identity

Release `0.4.0` is `communications-v0.4.0`. A valid source checkout must be the exact target of that annotated tag object. A lightweight tag, mutable branch URL, wrong tag, or checkout not equal to the tag target is NO-GO.

`destination-core-template.json` declares the exact 25 destination paths, SHA-256 hashes for all 21 unchanged files, the four generated paths, and the exact seven adaptable `agent-manifest.json` fields. The tagged materializer resolves the annotated tag object and target directly from Git and writes both exact SHAs into the generated destination `destination-core.json`, avoiding self-referential release metadata.

The seven and only seven adaptable manifest fields are `protocol_role`, `environment_id`, `github_owner`, `communications_repository`, `environment_type`, `status`, and `updated_at`. Bootstrap identity is not an operational role.

## Deterministic materialization

Run from an immutable `communications-v0.4.0` checkout. Supply the authenticated owner explicitly; it must equal the requested environment and canonical destination owner.

```text
node scripts/materialize-destination.mjs --environment <requested-environment> --authenticated-owner <authenticated-owner> --owner <destination-owner> --repository <owner/repository> --runtime <truthful-runtime-type> --output <empty-output-checkout> --updated-at <utc-date-time>
```

The Node-standard-library-only materializer performs no network request, model call, sourcing, role creation, or GitHub write. It copies only the destination core, creates the permanent mission acknowledgment, refuses any unrecognized nonempty destination, and is idempotent when the destination is already exact and valid. It never copies source prompts, tests, release history, materializer/verifier tooling, roles, messages, or Git history.

## Strict destination validation

```text
node scripts/validate-destination.mjs --root . --repository <owner/repository>
```

The offline validator requires the exact allowed tree and every static hash. It rejects unknown paths; `.env`; package or dependency files; `src/`, `server/`, `data/`, build output, databases, application code, `AGENTS.md`, `EVOLUTION.md`, token interfaces, GitHub write/synchronization logic, fabricated marketplace records, self-replication or expanded authority, mission changes, stale protocol fields, and roles created during bootstrap. It emits only sanitized finding codes and never credential values.

## Initialization, readiness, and independent verification

The materialized repository begins at `status: "initializing"` with no role. Commit and push it, then require the included read-only workflow to pass. Only afterward change the authorized ready-state manifest fields, validate, commit, push, and require the ready workflow to pass.

A self-reported READY state is advisory. From the immutable source checkout, the independent verifier reads a named public repository and exact commit, validates its complete tree and hashes, confirms the source tag object/target, initializing and ready workflow runs, and permanent mission acknowledgment, then emits a compact schema-bound GO/NO-GO attestation. It never grants access or activates a role.

```text
node scripts/verify-public-destination.mjs --repository <owner/repository> --commit <ready-commit> --initializing-commit <initializing-commit> --ready-commit <ready-commit> --mission-acknowledgment-id msg-mission-acknowledgment-v1
```

## Recovery and prompts

Contaminated history is never repaired by overlay. Follow `docs/RECOVERY_PROTOCOL_dev.md`: stop deployments/synchronization, revoke any entered token, remove applicable secrets, clear token-bearing browser storage, quarantine and privatize the old repository, preserve it for audit, and create a brand-new clean canonical repository.

Six versioned copy-ready artifacts are generated under `prompts/`: emergency containment, recovery/clean reinstall, one-line fresh install, independent verification, prepared WTB role activation, and emergency stop/revoke access. They contain no private repository identity or topology.

Canonical fresh-install prompt:

```text
Initialize NX environment <requested-environment> from https://raw.githubusercontent.com/normsexchange-dev/nx-codex-communications_dev/communications-v0.4.0/AUTOSTART.md
```

## Roles and messages

`main` is bootstrap DNA and contains an empty role index. Later, and only after independent GO plus separate Ray authorization, a bounded role may use `role/<role-slug>/<goal-slug>`. Public messages remain sanitized, append-only, sender-owned, schema-valid, and incapable of granting authority. No role or message is included in the release core.

## Source validation

```text
node scripts/validate-communications.mjs --branch main
node scripts/test-communications.mjs
```

All runtime code uses only Node.js standard-library modules. Destination validation and materialization make no network or model calls. Tests use reserved examples, sanitized captured-tree evidence, and no real or fabricated leads.
