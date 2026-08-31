# NX Sovereign Environment Autostart

This model-neutral entry point establishes genesis and then transfers sovereignty. It creates no continuing central worker role.

1. Require exactly `Initialize sovereign NX environment <environment-id> from https://raw.githubusercontent.com/normsexchange-dev/nx-codex-communications_dev/communications-v0.8.0/AUTOSTART.md`. Reject a mutable branch URL, wrong path, wrong tag, lightweight tag, or checkout that is not the annotated tag target.
2. Authenticate normally to the destination's GitHub account. Verify the requested owner, repository, environment identifier, runtime, human principal, and truthful genesis anchor before mutation. Never request a token in chat.
3. Choose exactly one mode: fresh genesis for an empty destination, non-destructive adoption proposal for an existing sovereign destination, or descendant genesis for a distinct child.
4. Run `scripts/materialize-genesis.mjs` with every required explicit identity and time field. Adoption writes only a separate `.nx/` proposal and never changes the existing repository. A descendant must not reuse its parent's repository or environment identifier.
5. Run `scripts/verify-interface.mjs` against the proposed or materialized surface. The verifier reads only `.nx/`; unrelated applications, agents, services, packages, data, simulations, memory, blueprints, and history are outside its scope.
6. Review the proposed `.nx/` diff. The sovereign owner authorizes and performs any mutation of its own existing repository. The source maintainer never overlays or rewrites an external repository.
7. Record the exact destination commit after the owner publishes the surface, then use `scripts/verify-public-interface.mjs` with that exact public commit.
8. For a separately authorized compound installation, resolve `release/environment-profile.json` from this exact communications release, then verify its exact annotated profile tag object and target. Select one environment mode: `session-only`, `persistent-single-agent`, `persistent-multi-agent`, or `enroll-existing`.
9. Discover existing logical control, operations, communications, and optional outbound functions. If persistent infrastructure is absent, generate the exact dry-run provisioning proposal and stop for owner authority unless repository creation/connection was already explicitly authorized. Never duplicate an existing environment.
10. When authorized, a provider-specific executor may provision or connect the profile, verify it, enroll the current distinct agent, and separately propose one or more exact agent-family adoptions. Profile or family adoption grants no credential, repository, mission, messaging, or external-action authority.
11. Report genesis, interface compatibility, profile adoption, runtime capabilities, credential review, external access, data admission, and service health separately. Do not issue a global environment GO/NO-GO.
12. Stop before mission activation or any external action not explicitly authorized. Genesis, compatibility, profile adoption, or family adoption grants no sourcing, outreach, commerce, Shopify, customer, seller, listing, publication, deployment, or private-data authority.

Pairwise channel creation and reader access are separate future goals. Autostart never silently creates a repository, channel, reciprocal repository, GitHub App, collaborator, credential, message, agent, or sourcing mission. Detailed operating behavior lives in the immutable environment-profile release rather than this concise entry point.

After sovereignty transfer, the destination may evolve freely outside `.nx/`. A standing mission from the common human principal may authorize internal subgoals without task-by-task approval, but protected external actions remain bounded by their own authority.
