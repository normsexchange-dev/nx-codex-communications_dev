# NX Environment Autostart

This model-agnostic entry point creates communications compatibility, not an operational role.

1. Require exactly `Initialize NX environment <requested-environment> from https://raw.githubusercontent.com/normsexchange-dev/nx-codex-communications_dev/communications-v0.4.0/AUTOSTART.md`. Reject a mutable branch URL, wrong path, wrong tag, lightweight tag, or source checkout not equal to the annotated tag target.
2. Before any mutation, authenticate to GitHub and require the authenticated owner to exactly equal the requested environment. Derive the canonical destination repository and stop on any mismatch.
3. If the canonical destination is nonempty and does not already pass the exact offline validator, stop. Do not overlay, delete, rewrite, or copy from contaminated history; use `docs/RECOVERY_PROTOCOL_dev.md`.
4. From the immutable tagged checkout, run `scripts/materialize-destination.mjs` with explicit environment, authenticated owner, owner, repository, truthful runtime type, empty output checkout, and UTC timestamp.
5. The materializer must copy the exact destination core, adapt only the seven authorized manifest fields, resolve and record the exact annotated tag object and target, create the permanent mission acknowledgment, and leave `roles/index.json` empty.
6. Run `scripts/validate-destination.mjs` offline. Unknown paths, application/dependency/data files, token interfaces, GitHub write logic, fabricated records, self-authority, stale identity, missing mission, or a bootstrap role are NO-GO.
7. Commit and push the initializing state, then require the included read-only workflow to exist, run, and pass. Missing, unavailable, unrun, failed, or unverifiable validation is NO-GO.
8. Only after initializing success, change the permitted ready-state manifest fields, validate again, commit, push, and require the ready workflow to pass.
9. Stop before substantive role work. Return the repository, initializing commit, ready commit, both workflow run IDs, and mission acknowledgment ID for independent verification.
10. Treat READY as advisory until the independent source-side verifier returns GO. Do not grant access or activate a role automatically.

This process performs no sourcing and grants no outreach, third-party messaging, purchasing, selling, Shopify mutation, customer/seller/listing creation, private-data publication, GitHub write synchronization, contract generation, or self-expanding authority.
