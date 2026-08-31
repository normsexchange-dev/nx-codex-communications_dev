# Managed NX Codex Communications Project Map

Generated file — do not edit manually.
Standard: `2026.08.31.2`
Source: `normsexchange-dev/ai-agent-control@ef174a2eb1daa3441ad80b4d3985fd29a0c55664`
Configuration hash: `57f4dc8a8fdc0920e37ac6d1014dc15cebe05f66067fe9eb83a6109a772d9ad4`

## Project identity

- Project: `codex-communications`
- Repository: `normsexchange-dev/nx-codex-communications_dev`
- Integration branch: `main`
- Operations: `normsexchange-dev/ai-agent-ops`

## Shared invariants

- Report only verified state. Never fabricate work, validation, usage, health, access, completion, or external-system results.
- Act only within the user's authorized scope. Read-only discovery is allowed when relevant; protected or external mutations require the authority defined by the project.
- Preserve unrelated work and established history. Never use destructive Git or filesystem operations merely to simplify a task.
- Never expose or commit credentials, passwords, tokens, cookies, private keys, recovery codes, authentication caches, private conversations, raw session transcripts, or customer data.
- Use official OAuth, browser, device-login, or provider authentication flows. Never request credentials in chat.
- Reverify identities, branches, targets, roles, and protected resources from actual state before targeting them.
- A project agent may modify its project when authorized, but may not silently redefine shared agent behavior. Shared behavior changes belong only in `ai-agent-control`, with a version change, validation, commit, and release history.
- Run configuration verification at startup and before substantial completion. A stale, drifted, malformed, mismatched, or unreachable configuration must not silently report healthy.
- Configuration failure blocks only work that genuinely depends on the unavailable or unsafe configuration. Finish independent safe work when possible.
- Coordinate concurrent work through explicit agent identities, roles, repositories, branches/worktrees, and clean handoffs. Never assume one agent per project or computer.
- Keep paths and runtime authority in ignored local state. Moves require explicit rebind; copies get a new workspace ID and inherit no authority.
- Apply changes only to managed files during synchronization. Preserve unrelated vendor settings and project-local state.
- Treat `AGENTS.md` as the portable project map. Worker identity comes from verified local enrollment, never from a shared clone, hostname guess, GitHub username, or generated project file.
- Use semantic capabilities rather than vendor names when deciding task eligibility. Missing capability evidence blocks only the action that requires it and must be reported as `UNKNOWN`, `DEGRADED`, or `NO-GO` as appropriate.
- Use one owner per active task branch, immutable operational records, and a valid exclusive resource lease before mutating shared external resources. Never force-push, overwrite another agent's record, or infer a lease from prose.
- Browser automation failure must be reported as a system exception whenever browser automation is required for the goal.
- Treat an external environment's self-reported READY state as advisory. An independent deterministic verifier may establish reserved-interface compatibility only; it cannot grant access or activate a role, and the user authorizes those actions separately.
- Exact immutable materialization proves genesis only. Once the genesis receipt transfers sovereignty, the destination owns its internal files, agents, roles, goals, applications, services, memory, policies, descendants, and history.
- Ongoing interoperability verification examines only the declared reserved `.nx/` interface surface. Files outside that surface are sovereign and may evolve without becoming configuration drift, contamination, or a failed compatibility check.
- Never collapse genesis validity, interface compatibility, credential review, external access, data admission, and service health into one global verdict. Report each dimension with its own evidence and use `UNKNOWN` when it was not established.
- Preserve truthful direct, descendant, hybrid, and divergent lineage. Never impersonate a parent or child environment, infer private reasoning, or require centralized disclosure of internal agent state.
- Distinguish internally available, declared, technically granted, standing-human-authorized, temporarily human-authorized, observed, requested, and revoked capabilities. A self-authored declaration cannot create external access or expand human authority.
- A common human principal may establish standing missions and capability boundaries. Sovereign environments may decompose an authorized standing mission into internal goals without requesting approval for every internal step, while protected external mutations remain separately authorized.
- Each external message-store repository has one publisher-writer. Peers are mechanically read-only, keep reader state elsewhere, and respond only from their own stores. Visibility is repository-level; messages grant no privacy or recipient roster.
- An agent-family blueprint is an exact immutable release without identity, memory, mission, credential, or authority. Instruction precedence is platform/system constraints → owner policy → constitution → family → role → mission → goal → memory; no silent override. Never promote raw logs, raw conversations, private reasoning, or private/unsupported material; require reviewed new releases. A sovereign environment decides whether to adopt, reject, defer, remain, fork, or specialize; foreign validation never adopts.
- Fence every prompt, command, or answer Ray must copy; questions include acceptable answers.
- Put each substantial pasteable handoff in one fenced `text` block; preceding copy-ready prompts use separate labeled fences.
- Keep prose outside and never omit required fences.

## Completion footer

Inside the final fenced `text` handoff block, emit these final three elements in order:

1. `SYSTEM EXCEPTIONS`, listing only `DEGRADED`, `NO-GO`, or `UNKNOWN` systems. If none: `None — SYSTEMS GO.`
2. Exactly one physical machine-readable usage line beginning `USAGE|`. Use `unavailable` for unknown values and never estimate. The exact format is `USAGE|session=...|elapsed=...|model=...|reasoning=...|input=...|cached=...|output=...|reasoning_output=...|total=...|5h_before=...|5h_after=...|weekly_before=...|weekly_after=...|window_reset=...|source=...`.
3. Exactly one final physical line beginning `RAY NEXT:` with one concrete imperative sentence. Nothing follows it.

## Operating map

1. Run `.agent-control/verify-agent-config.ps1`. Shared clones contain no worker identity; the verifier resolves ignored local enrollment against the central registry.
2. Read the reported `.agent-control/roles/<role>.md` before role-specific work.
3. Use one owned `agent/<agent-id>/<goal-slug>` task branch for normal mutations. Refresh operations state at startup, before shared mutation, and after meaningful completion.
4. Load detailed procedures on demand from the state files below; do not treat historical records as current policy.

Allowed roles: `coordinator`, `reviewer`.

### Project invariants

- This public repository contains task-agnostic sovereign genesis, interoperability, and publisher-owned message-store communications protocols.
- Exact materialization establishes genesis and then transfers sovereignty; it does not impose continuing control over destination internals.
- Each message-store repository has exactly one writer environment; authorized peers are mechanically read-only and respond only from their own publisher-owned repositories.
- Read scope and group privacy are repository-level; protocol records do not prove the complete recipient set or membership history.
- Public artifacts must not expose private repository names, private paths, credentials, internal topology, operational records, private prompts, or actual messages.

### Protected resources

- Annotated communications release tags and prior release contents are immutable.
- Never mutate an external-owner destination or publisher repository as part of source release, adoption, reading, or verification.
- Never classify sovereign evolution outside .nx as contamination or interface failure.
- The protocol may not grant sourcing, outreach, commerce, Shopify mutation, contract-generation, repository access, data admission, or expanded human authority.

### State and deeper context

- `README.md`
- `CHANGELOG.md`
- `COMMUNICATIONS_VERSION`
- `BOOTSTRAP_STATUS_dev.md`

## Managed configuration

- Do not hand-edit this file, `CLAUDE.md`, `.github/copilot-instructions.md`, `.gemini`, or `.agent-control` generated content.
- Shared behavior changes require a versioned authorized change in `normsexchange-dev/ai-agent-control`, validation, release, synchronization, and drift verification.
- If central control is unavailable, only verified last-known-good safe local/read-only work may continue; messaging, leases, and concurrent integration are blocked.
