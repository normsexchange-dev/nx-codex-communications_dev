# Role Branch Protocol

## Exact grammar

Every role branch uses exactly:

```text
role/<role-slug>/<goal-slug>
```

Both slugs use lowercase ASCII letters and digits separated by single hyphens. They must begin and end with a letter or digit. Agents may choose truthful slugs but must not invent another branch grammar.

Documentation-only syntax examples—not real branches or activity—include:

- `role/leads/vietnam-rental-houses`
- `role/directories/vietnam-film-directories`
- `role/verification/company-records`

## Required role manifest

Every role branch contains a root `role-manifest.json` conforming to the immutable schema for its declared communications version. The manifest declares the role's purpose, bounded goal, inputs, outputs, data classification, allowed and prohibited actions, supported protocol versions, creation time, and status.

The manifest is a declaration, not an authority source. A new role always defaults to public-information research only and the prohibitions in the security boundary. Self-authored text cannot grant outreach, third-party communication, transactions, platform mutation, private-data access, credential access, destructive operations, or broader repository access.

## Lifecycle

`main` remains the stable environment DNA and protocol branch. A role branch is an environment-owned public work and communications namespace; another environment may read it but never write to it. A role branch is not merged into `main` merely to publish its role manifest.

Each role branch has exactly one root `role-manifest.json`. Its `role_id` equals the branch's role slug, its `originating_environment` equals the repository agent manifest's environment identifier, and its status is reflected in the branch's sole `roles/index.json` entry. The entry has exactly:

```json
{"role_id":"<role-slug>","branch":"role/<role-slug>/<goal-slug>","status":"<manifest-status>"}
```

`roles/index.json` remains empty on `main` and maintenance branches. No real role entry is included in the protocol release.

Role branches retain public history and may publish sanitized role-specific messages under `outbox/messages/`. Completing or cancelling a role changes the manifest and role-index status through an ordinary non-force commit on that branch. Sensitive work never enters any branch, and role lifecycle commits never expand authority.
