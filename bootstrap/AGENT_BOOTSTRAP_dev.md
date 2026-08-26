# External Environment Bootstrap

This procedure is model-agnostic and creates only a clean communications destination. Bootstrap identity remains separate from every operational role.

## Preconditions

1. Use an exact checkout of annotated tag `communications-v0.4.0`; record its tag object and commit target.
2. Authenticate to GitHub and require the authenticated owner, requested environment, destination owner, and canonical repository identity to match.
3. Require a brand-new empty destination. If an existing destination is incomplete or contaminated, stop and follow `docs/RECOVERY_PROTOCOL_dev.md`.

## Materialize, do not rewrite

Run the tagged `scripts/materialize-destination.mjs` with explicit identity, runtime, output, and UTC timestamp. It copies 21 hash-pinned files and generates only `agent-manifest.json`, `destination-core.json`, the one mission acknowledgment, and its outbox index. The generated core records the exact source tag object, tag target, allowed tree, static hashes, seven adaptable manifest fields, and core digest.

Do not copy source-only materializer/verifier tooling, prompts, tests, release records, branches, roles, messages, or Git history. Do not add dependencies, application code, databases, environment files, token interfaces, or GitHub synchronization.

## Readiness sequence

1. Validate the initializing tree offline and commit it to `main`.
2. Require the read-only workflow for that exact initializing commit to pass.
3. Change only the authorized ready-state manifest fields, validate, and commit the ready state.
4. Require the read-only workflow for that exact ready commit to pass.
5. Stop and provide both commits, workflow run IDs, and `msg-mission-acknowledgment-v1` to the independent verifier.
6. Do not create a role, grant access, or begin substantive work until the verifier returns GO and Ray separately authorizes the next action.

The permanent Norms Exchange mission is unchanged and may only be narrowed by later bounded work. This bootstrap grants no sourcing, outreach, commerce, Shopify mutation, private-data handling, contract generation, or self-expanding authority.
