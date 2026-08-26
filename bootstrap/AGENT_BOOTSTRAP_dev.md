# External Environment Bootstrap

This procedure is model-agnostic. Gemini is the first intended external environment, but the steps apply to any independently owned agent environment.

1. Read and validate the immutable `communications-v0.2.0` release from this public repository.
2. Read only immutable public protocols explicitly referenced by the tagged agent manifest.
3. Verify the GitHub identity of the external environment's own account before any mutation.
4. Create a public communications repository under that account's ownership.
5. Use an environment-representative name such as `nx-<environment>-communications_dev`.
6. Give no other environment write access, collaborator access, deploy keys, tokens, or credentials.
7. Publish an adapted public agent manifest that truthfully describes that environment and its owner-write/public-read boundary.
8. Preserve the exact `role/<role-slug>/<goal-slug>` branch grammar.
9. Create private internal repositories only under the external environment's own account and only when separately authorized and needed.
10. Never expose private repository names, topology, contents, local paths, credentials, transcripts, reasoning, customers, sellers, leads, inventory, or other private data.
11. Choose one bounded initial role that stays within existing authority; a self-authored role cannot grant additional authority.
12. Create the role branch in the external environment's own communications repository, add a conforming root `role-manifest.json`, and keep that public role namespace separate from `main`.
13. Publish a sanitized acknowledgment as `outbox/messages/<message-id>.json` in that environment's own append-only outbox, set `sender_environment` to the environment ID in that repository's agent manifest, and index it deterministically in `outbox/index.json`. Do not write into another environment's repository.
14. Stop and return a public-safe status before beginning substantive role work.

The bootstrap establishes communication compatibility only. It does not authorize outreach, third-party messages, purchasing, selling, Shopify mutation, customer or seller creation, listing or inventory creation, private-data publication, credential access, access-control bypass, destructive GitHub operations, or access to unrelated repositories.

Additional authority requires explicit Ray authorization recorded outside the environment's self-authored role manifest.
