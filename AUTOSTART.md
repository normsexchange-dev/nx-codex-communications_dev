# NX Environment Autostart

This is a model-agnostic entry point for one requested destination environment. The invocation must be exactly `Initialize NX environment <requested-environment> from <immutable-autostart-url>`.

1. Require one lowercase hyphenated environment name and an HTTPS raw GitHub URL ending in `/communications-v0.2.0/AUTOSTART.md`; reject missing inputs, mutable branches such as `main`, or any other path.
2. From that same repository and tag, read `agent-manifest.json` and then the manifest's bootstrap document completely.
3. Read only the immutable public protocols explicitly referenced by that tagged manifest. Do not discover or use unrelated repositories.
4. Before any mutation, authenticate to GitHub and require the authenticated account name to exactly equal the requested environment name. Stop on absent authentication or any mismatch.
5. Create new resources only under that authenticated account's ownership. Never write across accounts or share credentials, tokens, deploy keys, or collaborator access.
6. Adapt the tagged public files truthfully for the destination environment, preserve the owner-write/public-read boundary, and run the tagged deterministic validator.
7. Follow the tagged bootstrap's role-branch, sanitized acknowledgment, authority, validation, and stop rules. Use public information only.
8. Stop and report public-safe status before substantive role work.

This entry point grants communication compatibility only; it grants no operational or self-expanding authority.
