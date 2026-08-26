# NX Environment Autostart

This is the model-agnostic entry point for one requested destination environment. The invocation must be exactly `Initialize NX environment <requested-environment> from <immutable-autostart-url>`.

1. Require one lowercase hyphenated environment name and the HTTPS raw GitHub URL ending in `/communications-v0.3.0/AUTOSTART.md`. Reject missing inputs, mutable branches, any other path, or a release whose Git reference is not an annotated tag object targeting the expected commit.
2. From that exact repository and tag, read `agent-manifest.json`, its bootstrap document, and both permanent mission files completely. Read only immutable public protocols referenced by that tagged manifest.
3. Before any mutation, authenticate to GitHub and require the authenticated account name to exactly equal the requested environment. Stop on absent authentication or mismatch.
4. Create resources only under that authenticated account. Never write across accounts or share credentials, tokens, deploy keys, or collaborator access.
5. Materialize the exact tagged 20-path core: copy 19 files unchanged and adapt only the seven destination identity/state fields in `agent-manifest.json`. Never adapt the protocol source or permanent mission.
6. Create the destination as `status: "initializing"`, add a schema-valid indexed mission acknowledgment, and run the tagged deterministic validator with the actual repository and branch binding.
7. Require the read-only GitHub Actions workflow to exist, run, and pass. Missing, unavailable, unrun, failed, or unverifiable validation is NO-GO.
8. Only after the initializing workflow passes, change status to `ready`, validate again, publish, and require the ready-state workflow to pass before reporting READY.
9. Load and acknowledge the permanent mission before creating any role. Roles and temporary goals remain separate and cannot alter mission or authority.
10. Stop and report public-safe status before substantive role work. Use public information only.

This entry point grants communication compatibility only. It grants no sourcing, outreach, third-party messaging, purchase, sale, Shopify mutation, customer or seller creation, listing publication, private-data publication, or self-expanding authority.
