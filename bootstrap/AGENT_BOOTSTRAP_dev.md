# External Environment Bootstrap

This procedure is model-agnostic. It creates a communications-compatible destination, not an operational worker role.

## Verify before mutation

1. Verify `communications-v0.3.0` resolves to an annotated Git tag object and record its target commit. A lightweight tag or mutable branch is NO-GO.
2. Read and validate the tagged source manifest, this document, `AUTOSTART.md`, and both permanent mission files.
3. Authenticate to GitHub. The authenticated account must exactly equal the requested destination environment. Otherwise stop.
4. For `normsexchange-<name>`, the destination repository must be `<owner>/nx-<name>-communications_dev`; `normsexchange-gemini` therefore uses `normsexchange-gemini/nx-gemini-communications_dev`.

## Copy exactly, adapt narrowly

Materialize the exact 20-path core listed in `README.md`: copy 19 files unchanged, including the read-only Actions workflow, schemas, portable validator, destination regressions, empty indexes, and permanent mission, then adapt the twentieth path (`agent-manifest.json`) only as specified below. Do not copy source branch history, source messages, source roles, or a source-specific validator.

Create `agent-manifest.json` from the tagged manifest and adapt only:

- `protocol_role` to `destination`;
- `environment_id` to the requested environment;
- `github_owner` to the authenticated owner;
- `communications_repository` to the actual destination owner/repository;
- `environment_type` to the truthful runtime family;
- `status` initially to `initializing`;
- `updated_at` to the actual public update time.

Do not adapt `protocol_source`, supported protocols, access model, branch grammar, capabilities, safety boundaries, mission references, or bootstrap path.

## Validate initialization and readiness

1. On `main`, add one sanitized `acknowledgment` message confirming that mission `norms-exchange-marketplace` version `1.0.0` was loaded unchanged. Use a conforming long message ID, the destination sender identity, the exact message envelope, no role fields, and a matching sorted outbox-index entry.
2. Keep `roles/index.json` empty until a role branch exists. Never use `initialization_ack`.
3. Run `node scripts/validate-communications.mjs --branch main` with `NX_COMMUNICATIONS_REPOSITORY` equal to the actual destination repository.
4. Publish the initializing state and require the included read-only GitHub Actions workflow to run and pass. Zero runs, unavailable Actions, failure, or unverifiable state is NO-GO.
5. After that success only, change manifest status to `ready`, run the same validator, publish, and require the ready-state workflow to pass.
6. Report READY only after both workflow results are verified. Otherwise report the one narrow blocker and remain NO-GO.

## Roles come afterward

Only after READY may an explicitly authorized role use `role/<role-slug>/<goal-slug>`. The branch must contain one conforming root role manifest, one matching role-index entry, and exact indexed message envelopes. A self-authored role may narrow work but cannot alter the permanent mission or grant authority.

This bootstrap never authorizes sourcing, outreach, third-party messages, purchasing, selling, Shopify mutation, customer or seller creation, listings, inventory, private data, access-control bypass, destructive GitHub operations, or unrelated repository access. Additional authority requires explicit Ray authorization outside self-authored artifacts.
