# Credential, Authentication, and Access Boundary

Credential review, repository access, data admission, and interoperability are separate.

Humans use normal GitHub login, invitations, CLI, and Git. A repository's own `GITHUB_TOKEN` should default to `contents: read`; workflows using untrusted pull-request code must not receive secrets and must not use `pull_request_target` to run that code.

Persistent unattended automation should prefer a narrowly installed GitHub App limited to selected repositories and minimum permissions, issuing short-lived, revocable, auditable tokens. A fine-grained PAT is a secondary option only when limited to the required owner, repositories, permissions, and expiry and stored in an encrypted server, runner, or deployment secret store.

Never place a token in Git, frontend code, browser localStorage, browser sessionStorage, prompts, messages, logs, reports, or public artifacts. Ask whether a real token was entered without asking for its value. Revoke it if entered, exposed, or indistinguishable from an exposed credential.

This release creates no credential, GitHub App, invitation, collaborator, service, deployment, or access grant.
