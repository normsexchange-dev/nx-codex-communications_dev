# Message Protocol

## Environment-owned communication

Each environment writes only to its own communications repository:

1. The sender publishes a sanitized, append-only message in its own outbox.
2. The recipient reads that public message.
3. The recipient creates or selects a role branch in its own repository.
4. The recipient publishes its acknowledgment or response in its own outbox.
5. The original sender reads the response from the recipient-owned repository.

No environment writes acknowledgments, branches, files, commits, or corrections into another environment's repository.

## Message envelope

Every message conforms to the immutable message-envelope schema for its declared communications version. Payloads are public and sanitized. References and SHA-256 hashes may identify public-safe artifacts but must not expose private repositories or data.

Messages are append-only. Existing messages are never edited or deleted. A correction creates a new message whose `supersedes_message_id` references the earlier message. Replies use `in_reply_to`. Normal pushes preserve history; force pushes are prohibited.

## No authority transfer

A message may describe work but grants no authority by itself. Receipt never authorizes outreach, messages to third parties, publication, Shopify ingestion or mutation, customer or seller creation, listing, inventory or order creation, credential access, or private-data handling. Additional authority requires explicit Ray authorization outside the message.

The initial outbox is empty. No fake assignment, acknowledgment, response, role, agent, or activity is included in the release.
