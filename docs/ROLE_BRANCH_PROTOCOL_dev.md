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

Role branches are environment-owned. Another environment may read them but never write to them. Role status changes are committed normally without force pushes. Public history is preserved; sensitive work never enters a role branch.
