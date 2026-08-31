# Public Reference Exchange Plan — Not Yet Published

This plan defines the smallest proof required before a 0.8 release decision. It does not authorize repository creation and does not claim that the repositories exist.

## Proposed topology

Two clean public test environments would each own one store for a shared `reference` group. The exact proposed repository names are:

```text
normsexchange-dev/nx-msg-reference-a-reference
normsexchange-dev/nx-msg-reference-b-reference
```

Each environment would have write access only to its own store and read access to the other. No token, local topology, reader cursor, user identity, or private repository name would be committed.

## Exchange script

1. Create both repositories only after explicit publication approval.
2. Validate empty manifests and repository permissions.
3. A publishes an `information` message using `nx.message@1.0.0`.
4. B pulls and records it in local reader state.
5. B publishes an `acknowledgement` in B's own store with an immutable reference to A's message.
6. A pulls and verifies the reference.
7. A publishes one deliberately unknown semantic followed by one supported message.
8. B proves that it parks the unknown item and still processes the later supported item.
9. Replay both stores and prove no duplicate delivery.
10. Publish a final closure event in each store and prove later appends fail.

## Required evidence

- exact repository and commit identities;
- sole-writer and read-only reader permission evidence without credential values;
- successful schema, digest, order, replay, unknown-semantic, and closure checks;
- confirmation that no model was invoked;
- confirmation that no unrelated local or remote state changed.

The reference proof must remain labelled `candidate` until an independent reader reproduces it. A successful local fixture is necessary but does not prove public repository interoperability.

## Candidate commands

These commands describe the eventual proof. They are not currently runnable against the two public URLs because repository creation is still unapproved and the repositories do not exist.

Initialize and validate each empty publisher store before Git publication:

```text
node scripts/initialize-message-store.mjs --output <empty-reference-a-stage> --group-id reference --publisher-environment reference-a --publisher-repository normsexchange-dev/nx-msg-reference-a-reference --created-at <utc-date-time>
node scripts/initialize-message-store.mjs --output <empty-reference-b-stage> --group-id reference --publisher-environment reference-b --publisher-repository normsexchange-dev/nx-msg-reference-b-reference --created-at <utc-date-time>
node scripts/validate-message-store.mjs --root <empty-reference-a-stage>
node scripts/validate-message-store.mjs --root <empty-reference-b-stage>
```

Propose, explicitly apply to the publisher's local clone, and revalidate one message:

```text
node scripts/propose-message-store-message.mjs --store-root <publisher-clone> --draft <validated-draft.json> --proposal <empty-proposal-directory>
node scripts/apply-message-store-proposal.mjs --store-root <publisher-clone> --proposal <proposal-directory> --authority-ref <local-owner-authority-reference>
node scripts/validate-message-store.mjs --root <publisher-clone>
```

The apply command mutates only the local publisher clone. It does not commit, push, create a repository, change permissions, access a credential, or invoke a model. Git publication remains a separate owner-authorized action.

After the repositories exist, an independent stranger can clone and validate both stores:

```text
git clone https://github.com/normsexchange-dev/nx-msg-reference-a-reference.git
git clone https://github.com/normsexchange-dev/nx-msg-reference-b-reference.git
node scripts/validate-message-store.mjs --root nx-msg-reference-a-reference
node scripts/validate-message-store.mjs --root nx-msg-reference-b-reference
git -C nx-msg-reference-a-reference rev-parse HEAD
git -C nx-msg-reference-b-reference rev-parse HEAD
```

Reader-state scanning requires a reader-local state file outside both publisher clones:

```text
node scripts/scan-message-store.mjs --root <publisher-clone> --state <reader-local-state.json> --output <new-reader-local-state.json> --observed-at <utc-date-time>
```
