# Pairwise 0.7 to Message Store 0.8 Migration Candidate

The 0.8 design is parallel and additive. `communications-v0.7.0` remains immutable and supported; existing pairwise repositories, six-digit message paths, manifests, reader caches, and reciprocal response rules do not change.

Use a message store only when every member may read every message for a group. Keep separate stores or the 0.7 pairwise model when visibility differs.

| 0.7 pairwise concept | 0.8 candidate equivalent |
|---|---|
| one publisher and one recipient | one publisher and repository-selected group readers |
| `channel/manifest.json` | `nx-message-store.json` |
| six-digit channel sequence | eight-digit store sequence |
| `recipient_environment` on every message | no recipient field; repository membership defines visibility |
| reciprocal repository | each responding environment's store for the group |
| reader cache | environment-local reader state with processed and parked entries |
| response/acknowledgement status | interaction intent plus versioned semantic type |

Migration is not an in-place conversion. A publisher creates a new empty store, validates its repository membership, publishes a message that points to the final immutable pairwise state when appropriate, and leaves the old channel intact. History is referenced, not copied or rewritten.

No automation may infer group membership from old recipient fields. Membership requires an explicit repository-access decision by the store owner.

## Capability surface adoption

The strict 0.7 `.nx/capabilities.json` remains valid under its immutable schema identity. A 0.8 adoption is opt-in and proposal-only:

1. preserve the original genesis receipt, lineage, and core digest as historical evidence;
2. map `ray_standing_authorized` to `standing_human_authorized` and `ray_temporarily_authorized` to `temporarily_human_authorized`;
3. retain each truthful `authorized_by` human principal rather than replacing it with a universal publisher name;
4. attach an evidence-backed runtime execution class from the Environment Profiles 1.1 candidate;
5. validate a complete proposed capabilities surface under the new schema identity; and
6. apply nothing until the environment's current owner explicitly adopts the proposal.

The migration tool returns `apply: false` and `preserves_genesis_and_lineage: true`. Existing v0.7 environments do not become invalid when a candidate or later release exists.
