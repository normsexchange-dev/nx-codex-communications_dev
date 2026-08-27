# Reserved Interoperability Protocol

`.nx/` is the only reserved interoperability surface. Its six files declare environment identity, genesis, lineage, protocol versions and hashes, capabilities, and evidence provenance. Unknown files inside `.nx/`, malformed documents, identity collisions, invalid hashes, stale protocol declarations, or parent impersonation are incompatible. Unknown files everywhere else are ignored.

Version negotiation keeps `current`, `supported`, `preferred`, `deprecated`, and `unsupported` values distinct. The receiver chooses its preferred common version when available, otherwise the highest common supported version. No common version is `NO_COMMON_VERSION`; it is not a judgment of the sovereign environment.

Compatibility results do not establish credential safety, service health, external access, data admission, factual truth, fitness for a mission, or ownership of another namespace. Verification makes no model call and grants no permission.
