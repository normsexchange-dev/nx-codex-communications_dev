import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE_REPOSITORY, TAG, VERSION } from './lib/destination-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const autostartUrl = `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/${TAG}/AUTOSTART.md`;
const releaseUrl = `https://github.com/${SOURCE_REPOSITORY}/tree/${TAG}`;

export function promptArtifacts() {
  return new Map([
    ['gemini-emergency-containment.txt', `GEMINI EMERGENCY CONTAINMENT ${VERSION}\n\nStop the current application, deployment, Pages site, background synchronization, and GitHub write automation now. Do not install or initialize anything yet. Revoke every PAT or token entered into the application, remove applicable deployment secrets, clear browser localStorage and sessionStorage that may contain a token, disable unnecessary Actions, Pages, Issues, Wiki, and deployment surfaces, and preserve the repository and history for audit. Do not delete, rewrite, copy, or publish application files, database content, contacts, prompts, transcripts, marketplace records, or credential values. Return only a sanitized containment checklist with DONE, BLOCKED, or NOT APPLICABLE for each item, and stop before recovery or fresh installation.\n`],
    ['gemini-recovery-clean-reinstall.txt', `GEMINI RECOVERY AND CLEAN REINSTALL ${VERSION}\n\nFirst confirm emergency containment is complete. Then rename the contaminated communications repository to an unmistakable quarantine name, make it private, preserve its history for audit, and keep unnecessary Actions, Pages, Issues, Wiki, and deployments disabled. Create a brand-new empty public repository at the canonical communications name under the authenticated owner. From the immutable source release ${releaseUrl}, run the tagged Node-standard-library materializer using the authenticated owner, requested environment, canonical repository, truthful runtime type, explicit UTC timestamp, and new empty output checkout. Copy no prior files, databases, branches, roles, messages, dependencies, or Git history. Commit and push the initializing state, require its read-only workflow to pass, then change only the authorized ready-state manifest fields, validate, commit, push, and require the ready workflow to pass. Stop before role work and return the exact repository, initializing commit, ready commit, workflow run IDs, mission acknowledgment ID, and no credential values.\n`],
    ['gemini-fresh-install.txt', `Initialize NX environment <requested-environment> from ${autostartUrl}\n`],
    ['codex-independent-verification.txt', `CODEX INDEPENDENT VERIFICATION ${VERSION}\n\nFrom an immutable ${TAG} source checkout, run: node scripts/verify-public-destination.mjs --repository <owner/repository> --commit <ready-commit> --initializing-commit <initializing-commit> --ready-commit <ready-commit> --mission-acknowledgment-id msg-mission-acknowledgment-v1. Return only the compact structured attestation. A destination READY claim is advisory until this verifier returns GO. Do not grant access, issue invitations, activate a role, or begin substantive work.\n`],
    ['gemini-wtb-role-activation.txt', `GEMINI WTB ROLE ACTIVATION ${VERSION} — PREPARED, NOT EXECUTED\n\nRun only after the independent destination verifier returns GO, Ray explicitly authorizes the WTB role, the private sourcing workspace exists under the authenticated external owner, and repository-only intake access is separately granted. Create the bounded role branch required by the communications protocol and acknowledge the specific future goal. Authority is limited to public-information research and private candidate staging. Do not contact anyone, perform outreach, buy or sell, publish to Shopify, create customers, sellers, listings, orders, or marketplace records, expose private information, fabricate evidence, or expand your own authority. Stop and return sanitized role/branch evidence before research begins.\n`],
    ['emergency-stop-revoke-access.txt', `EMERGENCY STOP / REVOKE ACCESS ${VERSION}\n\nStop the external agent and all synchronization or deployment processes. Revoke repository invitations and access, revoke any PAT or token used by the environment, remove applicable deployment secrets, clear token-bearing browser storage, disable unnecessary Actions/Pages/deployments, preserve evidence without publishing values, and classify every affected destination and role NO-GO. Do not delete or rewrite history, reissue access, resume work, or create records beyond a sanitized private incident. Return the exact access revoked, surfaces disabled, remaining Ray-side revocations, and one next safe action.\n`]
  ]);
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] || '--check';
  await mkdir(path.join(root, 'prompts'), { recursive: true });
  for (const [name, expected] of promptArtifacts()) {
    const target = path.join(root, 'prompts', name);
    if (mode === '--write') await writeFile(target, expected, 'utf8');
    else if (mode === '--check') {
      const actual = await readFile(target, 'utf8');
      if (actual !== expected) throw new Error(`stale prompt artifact: ${name}`);
    } else throw new Error('use --write or --check');
  }
  console.log(`prompt-artifacts: ${mode === '--write' ? 'WRITTEN' : 'GO'} (${promptArtifacts().size})`);
}
