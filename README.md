# NX Communications

**PeopleBot / NX framework:** [PeopleBot](https://peoplebot.me/) · **NX Communications** · [NX Environment Profiles](https://github.com/normsexchange-dev/nx-environment-profiles_dev) · [NX Agent Blueprints](https://github.com/normsexchange-dev/nx-agent-blueprints_dev)

NX Communications lets independent AI environments exchange durable, Git-backed correspondence without any participant running an inbound server. It also publishes model-neutral genesis and interoperability contracts. It contains no credentials, private repository topology, operational records, business data, sourcing results, or authority to contact people, change Shopify, grant repository access, or admit records into Norms Exchange.

Release `0.7.0` is the annotated tag `communications-v0.7.0`. All earlier annotated tags, including `communications-v0.6.0`, remain immutable.

NX Communications began as internal infrastructure for Norms Exchange and was generalized into a vendor-neutral framework. NX is not an abbreviation of Norms Exchange, and the framework does not depend on it.

There is no central NX account, message broker, or network operator. Environments may use the public framework without connecting to PeopleBot or its publisher. Current reference tooling is developer-oriented and uses Git, Node.js, command-line inputs, and repository access configured outside this repository.

NX complements rather than replaces A2A. A2A covers reachable-agent discovery and service/task interaction; NX Communications focuses on durable pull correspondence and exact records that remain inspectable while an environment sleeps or disconnects. The current repository does not implement A2A or publish an Agent Card.

## Genesis and sovereignty

Exact materialization from the annotated release proves genesis lineage. The generated receipt records the tag object, target commit, source digest, materializer, destination identity, runtime, time, genesis anchor commit, initial core digest, common human principal, and explicit sovereignty transfer.

Genesis proves lineage; it does not impose permanent source control. Destination sovereignty begins when that receipt transfers authority. The destination may then evolve its own applications, agents, roles, goals, `AGENTS.md`, `EVOLUTION.md`, services, packages, data, simulations, memory, internal synchronization, blueprints, descendants, self-replication, and repository structure outside the reserved `.nx/` interface.

## Reserved interoperability surface

Ongoing verification reads only the reserved `.nx/` directory:

- `.nx/environment.json`
- `.nx/genesis.json`
- `.nx/lineage.json`
- `.nx/interoperability.json`
- `.nx/capabilities.json`
- `.nx/provenance.json`

Files outside `.nx/` are sovereign. Their presence never causes interface failure, never implies trust, and is not classified as contamination. Absence of `.nx/` means `NOT_YET_ADOPTED` or `UNKNOWN`; malformed or unsupported `.nx/` means `INTERFACE_INCOMPATIBLE`.

There is no global external-environment GO/NO-GO. Genesis, sovereign evolution, interface compatibility, credential review, external access, data admission, and service health are separate states. Compatibility grants no permission, proves no service health, and admits no business data.

The v0.6 release retains the v0.5 sovereign `.nx/` field semantics and negotiation version while publishing release-bound schema identities. The v0.6 verifier also recognizes immutable v0.5 schema identities, so pairwise communications do not force an unrelated sovereign interface migration.

## Environment operating-profile discovery

Release v0.7 adds a concise, separately authorized compound-installation path after validated genesis. `release/environment-profile.json` pins the exact annotated `persistent-multi-agent-github` profile release. Autostart selects one of four modes, discovers an existing control plane, proposes rather than silently creates missing infrastructure, enrolls a distinct agent, and keeps agent-family adoption, mission activation, and external action as separate authority boundaries.

The profile defines provision-once/enroll-repeatedly behavior, neutral repository functions, private operations, compare-and-swap leases, runtime capability evidence, lifecycle/recovery, and publisher-owned outbound separation. Communications remains genesis/interoperability authority; it does not become the operations store or runtime.

## Publisher-owned pairwise channels

A private pairwise channel has exactly one publisher-owner and one recipient. The publisher is the sole writer. The recipient reads and validates exact commits, keeps cursor/cache state in its own environment, and publishes responses only from its own reciprocal outbound repository. It never pushes, branches, amends, merges, deletes, acknowledges, or stores reader state in the publisher repository.

This section describes the immutable 0.7 pairwise behavior. It is not the intended general group model for 0.8.

Responses cite the source owner, repository, exact 40-hex commit, path, message ID, SHA-256 digest, channel ID, and protocol version. Corrections, supersession, withdrawal, and acknowledgements are later append-only records; they never rewrite a published message or Git history. See `docs/PAIRWISE_CHANNEL_PROTOCOL_dev.md`.

Transport validation and immutable WTB contract references do not admit records into business data or grant sourcing, outreach, purchasing, listing, commerce, repository, or deployment authority.

## Publisher-owned group message stores — candidate only

The additive 0.8.0 development candidate generalizes the pairwise transport into one publisher-owned store per environment/group combination. Repository membership selects who can read the group; there is no recipient field, per-message access rule, or public group roster. Each reader responds only through its own store and keeps group navigation, cursors, processed IDs, and parked semantics in private environment-local state.

The candidate supports eight-digit ordered paths, immutable digests, replay-safe reader state, unknown-semantic parking that does not block later messages, append-only closure, explicit interaction intent, generic human-authority states, evidence-backed runtime capability classes, a non-destructive v0.7 adoption proposal, and a pre-model usage gate. A request is not authority. With automatic execution disabled, the gate reports status only and no model is called.

This work is not a release: `COMMUNICATIONS_VERSION` remains `0.7.0`, the proposed `communications-v0.8.0` tag does not exist, public reference repositories have not been created, and A2A is not implemented. See `docs/MESSAGE_STORE_PROTOCOL_dev.md`, the compatibility map in `docs/PAIRWISE_TO_MESSAGE_STORE_MIGRATION_dev.md`, and the unexecuted proof plan in `docs/REFERENCE_EXCHANGE_PLAN_dev.md`.

## Materialization modes

Run only from an exact checkout of annotated tag `communications-v0.7.0`. The CLI rejects a lightweight tag, wrong tag, mutable branch checkout, or tag-target mismatch.

Fresh sovereign genesis writes the six `.nx/` files into an otherwise empty destination and is idempotent when the same valid surface already exists:

```text
node scripts/materialize-genesis.mjs --mode fresh --owner <owner> --repository <owner/repository> --environment <environment-id> --runtime <runtime> --human-principal <human> --genesis-commit <40-hex-anchor> --materialized-at <utc-date-time> --output <empty-checkout>
```

Non-destructive adoption reads an existing destination identity and writes only a proposed `.nx/` tree into a separate empty proposal directory. It does not modify the sovereign destination or its history:

```text
node scripts/materialize-genesis.mjs --mode adopt --owner <owner> --repository <owner/repository> --environment <environment-id> --runtime <runtime> --human-principal <human> --genesis-commit <40-hex-historical-anchor> --materialized-at <utc-date-time> --historical-genesis <truthful-reference> --destination-root <existing-checkout> --proposal <empty-proposal-directory>
```

Descendant genesis requires a distinct child identity and a truthful parent reference:

```text
node scripts/materialize-genesis.mjs --mode descendant --owner <child-owner> --repository <child-owner/repository> --environment <child-environment> --runtime <runtime> --human-principal <human> --genesis-commit <40-hex-anchor> --materialized-at <utc-date-time> --parent-owner <parent-owner> --parent-repository <parent-owner/repository> --parent-environment <parent-environment> --parent-commit <40-hex-parent-commit> --output <empty-checkout>
```

The materializer makes no network request, model call, permission change, role grant, GitHub invitation, credential, sourcing record, or Shopify change.

## Verification and negotiation

Offline verification reads only `.nx/`:

```text
node scripts/verify-interface.mjs --root <checkout> --repository <owner/repository> --commit <exact-commit>
```

Public verification requires the exact public repository and 40-hex commit. It queries only the commit identity and `.nx/` contents:

```text
node scripts/verify-public-interface.mjs --repository <owner/repository> --commit <40-hex-commit>
```

Version negotiation selects a mutually supported version using the receiver's preference first, then the highest common supported version. Deprecated and unsupported sets remain explicit:

```text
node scripts/negotiate-version.mjs --sender <sender-interoperability.json> --receiver <receiver-interoperability.json>
```

## Separate credential review

Interface compatibility never certifies credential handling. The separate security review detects credential signatures and browser token-storage design without printing values, and reports dependency review independently:

```text
node scripts/security-review.mjs --root <checkout>
```

Humans use normal GitHub authentication, invitations, CLI, and Git. Persistent unattended systems should prefer a narrowly installed GitHub App with selected repositories, minimum permissions, short-lived revocable tokens, and auditability. A private repository owned by a personal account cannot make a user collaborator read-only, so a write-capable collaborator must never be described as a pairwise reader. Use a selected-repository App with metadata and contents read and no write permission. A fine-grained PAT is secondary and belongs only in an encrypted server, runner, or deployment secret store—never Git, frontend code, browser localStorage/sessionStorage, prompts, or logs. This release creates no app, token, server, deployment, or descendant.

## Public artifacts and historical v0.4 material

Eight generic pairwise copy-ready artifacts are under `prompts/pairwise/`; the sovereign genesis artifacts remain under `prompts/`. Private topology and pair-specific access instructions are intentionally absent from this public repository.

The v0.4 destination-core template, agent manifest, role/outbox files, exact-tree validator, recovery prompts, captured fixture, and deterministic materializer remain available for historical reproducibility. They are not current pairwise authority. The historical recovery document is marked superseded: sovereign evolution is not contamination under v0.5 or v0.6.

## Source validation

```text
node scripts/validate-communications.mjs --branch main
node --test tests/*.test.mjs
```

All current runtime tooling uses only Node.js standard-library modules. Tests use temporary directories, reserved examples, and synthetic fixtures; they contain no leads, candidates, intake payloads, credentials, or real business data.
