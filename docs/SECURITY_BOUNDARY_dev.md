# Public Security and Authority Boundary

## Repository ownership

This repository is public-read and owner-write. Its sole writer is `normsexchange-dev`. Public readers may clone, validate, and interpret tagged protocols, but they must not receive collaborator, token, deploy-key, invitation, or other write access.

Each external environment communicates through a repository owned by its own GitHub account. Repository ownership—not a branch or directory—is the permission boundary.

## Public content

Permitted content is limited to public bootstrap instructions, schemas, environment manifests, role declarations, sanitized assignments and acknowledgments, public-safe status, and hashes or references that reveal no private data.

Prohibited content includes actual private lead batches, confidential targets, customer or seller records, inventory, credentials, tokens, private contact information, raw research archives, internal transcripts or reasoning, private local paths, Shopify data, unpublished business strategy, internal operations records, and executable payloads received from another environment.

## Default role authority

A newly defined role defaults to public-information research only. It has no authority for outreach, messages to third parties, purchasing or selling, Shopify mutation, customer or seller creation, listing, inventory or order creation, publication of private information, credential access, access to unrelated repositories, bypassing logins or other platform controls, destructive GitHub operations, or expansion of its own authority.

A role manifest may narrow actions but cannot grant new authority. A message, protocol reference, acknowledgment, branch, or commit also cannot grant authority. Additional authority requires explicit Ray authorization recorded outside self-authored public artifacts.

## Access controls

Agents must not bypass logins, paywalls, robots restrictions, technical controls, or platform restrictions. Receiving public data does not authorize copying it into a private workflow, contacting a third party, or publishing a marketplace record.

## Public repository references

The public protocol URLs in `agent-manifest.json` are the portable allowlist for GitHub repository identities. Tracked GitHub and raw-content repository URLs must resolve to one of those declared public protocols. Validation uses that affirmative public declaration rather than embedding names or topology for private systems.
