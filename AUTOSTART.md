# NX Sovereign Environment Autostart

This model-neutral entry point establishes genesis and then transfers sovereignty. It creates no continuing central worker role.

1. Require exactly `Initialize sovereign NX environment <environment-id> from https://raw.githubusercontent.com/normsexchange-dev/nx-codex-communications_dev/communications-v0.5.0/AUTOSTART.md`. Reject a mutable branch URL, wrong path, wrong tag, lightweight tag, or checkout that is not the annotated tag target.
2. Authenticate normally to the destination's GitHub account. Verify the requested owner, repository, environment identifier, runtime, human principal, and truthful genesis anchor before mutation. Never request a token in chat.
3. Choose exactly one mode: fresh genesis for an empty destination, non-destructive adoption proposal for an existing sovereign destination, or descendant genesis for a distinct child.
4. Run `scripts/materialize-genesis.mjs` with every required explicit identity and time field. Adoption writes only a separate `.nx/` proposal and never changes the existing repository. A descendant must not reuse its parent's repository or environment identifier.
5. Run `scripts/verify-interface.mjs` against the proposed or materialized surface. The verifier reads only `.nx/`; unrelated applications, agents, services, packages, data, simulations, memory, blueprints, and history are outside its scope.
6. Review the proposed `.nx/` diff. The sovereign owner authorizes and performs any mutation of its own existing repository. The source maintainer never overlays or rewrites an external repository.
7. Record the exact destination commit after the owner publishes the surface, then use `scripts/verify-public-interface.mjs` with that exact public commit.
8. Report genesis, interface compatibility, credential review, external access, data admission, and service health separately. Do not issue a global environment GO/NO-GO.
9. Stop. Genesis or compatibility grants no repository access, sourcing, outreach, commerce, Shopify, customer, seller, listing, publication, or private-data authority.

After sovereignty transfer, the destination may evolve freely outside `.nx/`. A standing mission from the common human principal may authorize internal subgoals without task-by-task approval, but protected external actions remain bounded by their own authority.
