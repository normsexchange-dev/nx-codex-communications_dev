# Contaminated Destination Recovery Protocol

An incomplete destination remains NO-GO. A destination containing any unknown path, application code, dependency manifest, database, environment file, token interface, GitHub write logic, fabricated marketplace record, role created during bootstrap, or self-expanding authority is contaminated. Never overlay the clean protocol onto that repository or copy its Git history.

## Containment first

The destination owner or Ray—not the source maintainer or verifier—must:

1. stop any deployed application and background synchronization;
2. revoke every PAT or token entered into the application;
3. remove applicable deployment secrets;
4. clear browser localStorage and sessionStorage that may contain a token;
5. disable unnecessary Actions, Pages, Issues, Wiki, and deployment surfaces;
6. rename the contaminated repository to an unmistakable quarantine name;
7. make the quarantine repository private; and
8. preserve it for audit without deletion, force-push, or history rewrite.

Do not reproduce credential values in reports. If a credential may have been used, revocation is a Ray/destination-owner action even when no value is visible in Git.

## Brand-new clean installation

After containment is confirmed, the destination owner creates a brand-new empty public repository at the canonical communications name. From an immutable annotated `communications-v0.4.0` checkout, run the deterministic materializer with the authenticated owner, destination environment, canonical repository, truthful runtime type, explicit UTC timestamp, and empty output checkout.

Copy no old application files, dependency files, database files, branches, roles, messages, credentials, deployment configuration, or Git history. Publish the initializing state and require the read-only workflow to pass. Then change only the authorized ready-state manifest fields, validate, publish, and require the ready workflow to pass. Stop before substantive role work.

The destination's READY claim is advisory. Access and role activation remain blocked until the independent source-side public-destination verifier inspects the exact ready commit and returns a schema-valid `GO` attestation.
