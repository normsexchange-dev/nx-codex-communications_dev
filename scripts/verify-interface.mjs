import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CAPABILITY_STATES, INTERFACES, NX_FILES, PROVENANCE, SOURCE_REPOSITORY, SOVEREIGN_INTERFACE_VERSION, SOVEREIGN_SCHEMA_TAG, TAG, VERSION,
  assert, coreDigestPayload, exactKeys, hashJson, parseArgs, readJson, sanitizedError,
  schemaUrl, stableStringify, validateIdentity
} from './lib/nx-interface.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function schemaIdentity(value, name) {
  return [schemaUrl(name), schemaUrl(name, SOVEREIGN_SCHEMA_TAG)].includes(value.$schema);
}

function baseResult(repository = null, commit = null) {
  return {
    schema_version: '1.0.0', repository, commit,
    genesis: 'GENESIS_UNVERIFIED', environment_state: 'UNKNOWN', interface: 'UNKNOWN',
    credential_review: 'UNKNOWN', external_access: 'UNKNOWN', data_admission: 'UNKNOWN',
    service_health: 'NOT_ASSESSED', negotiated_version: null, environment_id: null,
    finding_codes: []
  };
}

function validateEnvironment(value, expectedRepository) {
  exactKeys(value, ['$schema', 'schema_version', 'environment_id', 'namespace_owner', 'repository', 'environment_type', 'runtime', 'human_principal', 'created_at'], 'environment');
  assert(schemaIdentity(value, 'nx-environment.schema.json') && value.schema_version === '1.0.0', 'environment_schema_invalid');
  validateIdentity({ owner: value.namespace_owner, repository: value.repository, environmentId: value.environment_id });
  assert(value.environment_type === 'sovereign', 'environment_type_invalid');
  assert(typeof value.runtime === 'string' && value.runtime.trim(), 'environment_runtime_invalid');
  assert(typeof value.human_principal === 'string' && value.human_principal.trim(), 'environment_human_principal_invalid');
  assert(Number.isFinite(Date.parse(value.created_at)), 'environment_time_invalid');
  if (expectedRepository) assert(value.repository === expectedRepository, 'environment_repository_binding_mismatch');
}

function validateGenesis(value, environment) {
  exactKeys(value, ['$schema', 'schema_version', 'genesis_type', 'canonical_release', 'materializer', 'destination', 'materialized_at', 'genesis_commit', 'initial_core_digest', 'human_principal', 'sovereignty_transfer'], 'genesis');
  assert(schemaIdentity(value, 'nx-genesis.schema.json') && value.schema_version === '1.0.0', 'genesis_schema_invalid');
  assert(['fresh', 'historical_adoption', 'descendant'].includes(value.genesis_type), 'genesis_type_invalid');
  exactKeys(value.canonical_release, ['repository', 'tag', 'tag_object', 'target_commit', 'source_digest'], 'genesis_release');
  assert(value.canonical_release.repository === SOURCE_REPOSITORY && [TAG, 'communications-v0.5.0'].includes(value.canonical_release.tag), 'genesis_release_identity_invalid');
  assert(SHA_PATTERN.test(value.canonical_release.tag_object) && SHA_PATTERN.test(value.canonical_release.target_commit) && SHA256_PATTERN.test(value.canonical_release.source_digest), 'genesis_release_hash_invalid');
  exactKeys(value.materializer, ['name', 'version'], 'genesis_materializer');
  const expectedMaterializer = value.canonical_release.tag === TAG ? VERSION : '0.5.0';
  assert(value.materializer.name === 'nx-sovereign-genesis' && value.materializer.version === expectedMaterializer, 'genesis_materializer_invalid');
  exactKeys(value.destination, ['owner', 'repository', 'environment_id', 'runtime'], 'genesis_destination');
  assert(value.destination.owner === environment.namespace_owner && value.destination.repository === environment.repository && value.destination.environment_id === environment.environment_id && value.destination.runtime === environment.runtime, 'genesis_destination_mismatch');
  assert(Number.isFinite(Date.parse(value.materialized_at)) && SHA_PATTERN.test(value.genesis_commit) && SHA256_PATTERN.test(value.initial_core_digest), 'genesis_anchor_invalid');
  assert(value.human_principal === environment.human_principal, 'genesis_human_principal_mismatch');
  exactKeys(value.sovereignty_transfer, ['state', 'recipient', 'effective_at'], 'sovereignty_transfer');
  assert(value.sovereignty_transfer.state === 'transferred' && value.sovereignty_transfer.recipient === environment.repository && value.sovereignty_transfer.effective_at === value.materialized_at, 'sovereignty_transfer_invalid');
}

function validateLineage(value, environment, genesis) {
  exactKeys(value, ['$schema', 'schema_version', 'lineage_type', 'current', 'canonical_genesis', 'parent', 'divergence', 'amendments', 'descendants'], 'lineage');
  assert(schemaIdentity(value, 'nx-lineage.schema.json') && value.schema_version === '1.0.0', 'lineage_schema_invalid');
  assert(['direct', 'descendant', 'hybrid'].includes(value.lineage_type), 'lineage_type_invalid');
  exactKeys(value.current, ['environment_id', 'repository'], 'lineage_current');
  assert(value.current.environment_id === environment.environment_id && value.current.repository === environment.repository, 'lineage_current_impersonation');
  exactKeys(value.canonical_genesis, ['repository', 'tag', 'target_commit'], 'lineage_canonical_genesis');
  assert(value.canonical_genesis.repository === genesis.canonical_release.repository && value.canonical_genesis.tag === genesis.canonical_release.tag && value.canonical_genesis.target_commit === genesis.canonical_release.target_commit, 'lineage_canonical_genesis_mismatch');
  exactKeys(value.divergence, ['allowed', 'declared', 'description'], 'lineage_divergence');
  assert(value.divergence.allowed === true && typeof value.divergence.declared === 'boolean', 'lineage_divergence_invalid');
  assert(Array.isArray(value.amendments) && Array.isArray(value.descendants), 'lineage_collections_invalid');
  if (value.lineage_type === 'descendant' || (value.lineage_type === 'hybrid' && value.parent !== null)) {
    exactKeys(value.parent, ['environment_id', 'repository', 'commit'], 'lineage_parent');
    validateIdentity({ owner: value.parent.repository.split('/')[0], repository: value.parent.repository, environmentId: value.parent.environment_id });
    assert(SHA_PATTERN.test(value.parent.commit), 'lineage_parent_commit_invalid');
    assert(value.parent.repository !== environment.repository && value.parent.environment_id !== environment.environment_id, 'lineage_parent_impersonation');
  } else assert(value.parent === null, 'lineage_parent_unexpected');
}

function validateCapabilities(value, environment) {
  exactKeys(value, ['$schema', 'schema_version', 'environment_id', 'declarations'], 'capabilities');
  assert(schemaIdentity(value, 'nx-capabilities.schema.json') && value.schema_version === '1.0.0' && value.environment_id === environment.environment_id, 'capabilities_identity_invalid');
  assert(Array.isArray(value.declarations), 'capabilities_declarations_invalid');
  for (const entry of value.declarations) {
    exactKeys(entry, ['capability_id', 'scope', 'state', 'authorized_by', 'valid_from', 'expires_at', 'evidence_refs'], 'capability_declaration');
    assert(typeof entry.capability_id === 'string' && entry.capability_id && ['internal', 'external'].includes(entry.scope) && CAPABILITY_STATES.includes(entry.state), 'capability_declaration_invalid');
    assert(Array.isArray(entry.evidence_refs), 'capability_evidence_invalid');
    if (entry.state.startsWith('ray_')) assert(entry.authorized_by === environment.human_principal, 'capability_human_authority_invalid');
    if (entry.valid_from !== null) assert(Number.isFinite(Date.parse(entry.valid_from)), 'capability_valid_from_invalid');
    if (entry.expires_at !== null) assert(Number.isFinite(Date.parse(entry.expires_at)), 'capability_expiry_invalid');
  }
}

function validateProvenance(value, environment) {
  exactKeys(value, ['$schema', 'schema_version', 'environment_id', 'records'], 'provenance');
  assert(schemaIdentity(value, 'nx-provenance.schema.json') && value.schema_version === '1.0.0' && value.environment_id === environment.environment_id, 'provenance_identity_invalid');
  assert(Array.isArray(value.records), 'provenance_records_invalid');
  for (const entry of value.records) {
    exactKeys(entry, ['record_id', 'classification', 'subject', 'evidence_refs', 'observed_at', 'assigned_by'], 'provenance_record');
    assert(typeof entry.record_id === 'string' && entry.record_id && PROVENANCE.includes(entry.classification), 'provenance_record_invalid');
    assert(typeof entry.subject === 'string' && entry.subject && Array.isArray(entry.evidence_refs), 'provenance_subject_invalid');
    assert(Number.isFinite(Date.parse(entry.observed_at)), 'provenance_time_invalid');
    if (entry.classification === 'public_observation') assert(entry.evidence_refs.length > 0, 'public_observation_evidence_required');
    if (entry.classification === 'buyer_confirmed') assert(entry.assigned_by === 'buyer', 'buyer_confirmed_assigner_invalid');
    if (entry.classification === 'norms_verified') assert(['Ray', 'normsexchange-dev'].includes(entry.assigned_by), 'norms_verified_assigner_invalid');
  }
}

function validateInteroperability(value) {
  exactKeys(value, ['$schema', 'schema_version', 'protocol_id', 'current', 'supported', 'preferred', 'deprecated', 'unsupported', 'receiver_selection', 'interfaces', 'hashes'], 'interoperability');
  assert(schemaIdentity(value, 'nx-interoperability.schema.json') && value.schema_version === '1.0.0', 'interoperability_schema_invalid');
  assert(value.protocol_id === 'nx-sovereign-interoperability' && value.current === SOVEREIGN_INTERFACE_VERSION, 'interoperability_protocol_invalid');
  assert(Array.isArray(value.supported) && value.supported.includes(SOVEREIGN_INTERFACE_VERSION) && value.preferred === SOVEREIGN_INTERFACE_VERSION, 'interoperability_version_invalid');
  assert(Array.isArray(value.deprecated) && Array.isArray(value.unsupported), 'interoperability_version_sets_invalid');
  assert(value.receiver_selection === 'highest_common_preferred_then_highest_common_supported', 'interoperability_negotiation_invalid');
  assert(stableStringify(value.interfaces) === stableStringify(INTERFACES), 'interoperability_interfaces_invalid');
  exactKeys(value.hashes, ['environment.json', 'genesis.json', 'lineage.json', 'capabilities.json', 'provenance.json'], 'interoperability_hashes');
  for (const digest of Object.values(value.hashes)) assert(SHA256_PATTERN.test(digest), 'interoperability_hash_invalid');
}

export async function verifyInterface(root, options = {}) {
  const result = baseResult(options.expectedRepository || null, options.commit || null);
  const nxRoot = path.join(root, '.nx');
  let entries;
  try { entries = (await readdir(nxRoot, { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name).sort(); }
  catch (error) {
    if (error.code === 'ENOENT') { result.interface = 'NOT_YET_ADOPTED'; result.finding_codes.push('nx_surface_absent'); return result; }
    throw error;
  }
  try {
    assert(stableStringify(entries) === stableStringify(NX_FILES), 'nx_reserved_tree_invalid');
    const documents = Object.fromEntries(await Promise.all(NX_FILES.map(async (name) => [name, await readJson(path.join(nxRoot, name))])));
    const environment = documents['environment.json'];
    const genesis = documents['genesis.json'];
    const lineage = documents['lineage.json'];
    const capabilities = documents['capabilities.json'];
    const provenance = documents['provenance.json'];
    const interoperability = documents['interoperability.json'];
    validateEnvironment(environment, options.expectedRepository);
    validateGenesis(genesis, environment);
    validateLineage(lineage, environment, genesis);
    validateCapabilities(capabilities, environment);
    validateProvenance(provenance, environment);
    validateInteroperability(interoperability);
    for (const [name, digest] of Object.entries(interoperability.hashes)) assert(hashJson(documents[name]) === digest, `interoperability_hash_mismatch:${name}`);
    assert(hashJson(coreDigestPayload(environment, lineage, capabilities, provenance, interoperability)) === genesis.initial_core_digest, 'genesis_initial_core_digest_mismatch');
    result.genesis = 'GENESIS_VALIDATED';
    result.interface = 'INTERFACE_COMPATIBLE';
    result.negotiated_version = SOVEREIGN_INTERFACE_VERSION;
    result.environment_id = environment.environment_id;
    return result;
  } catch (error) {
    result.interface = 'INTERFACE_INCOMPATIBLE';
    result.finding_codes.push(sanitizedError(error));
    return result;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = path.resolve(options.root || '.');
  const result = await verifyInterface(root, { expectedRepository: options.repository || null, commit: options.commit || null });
  console.log(JSON.stringify(result, null, 2));
  if (result.interface === 'INTERFACE_INCOMPATIBLE') process.exitCode = 2;
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`INTERFACE ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
}
