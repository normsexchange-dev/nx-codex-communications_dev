import { assert, exactKeys } from './nx-interface.mjs';

export const CAPABILITIES_CANDIDATE_VERSION = '0.8.0';
export const GENERIC_AUTHORITY_STATES = [
  'internal_available', 'declared', 'technically_granted',
  'standing_human_authorized', 'temporarily_human_authorized',
  'observed', 'requested', 'revoked'
];
export const EXECUTION_CLASSES = [
  'session-only', 'interactive-tool', 'persistent-execution', 'continuous-service'
];
export const V07_AUTHORITY_MAPPING = Object.freeze({
  internal_available: 'internal_available',
  declared: 'declared',
  technically_granted: 'technically_granted',
  ray_standing_authorized: 'standing_human_authorized',
  ray_temporarily_authorized: 'temporarily_human_authorized',
  observed: 'observed',
  requested: 'requested',
  revoked: 'revoked'
});

const SHA256 = /^[a-f0-9]{64}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function capabilitiesCandidateSchemaUrl(name = 'nx-capabilities-v0.8.schema.json') {
  return `https://raw.githubusercontent.com/normsexchange-dev/nx-codex-communications_dev/communications-v0.8.0/schemas/${name}`;
}

function dateTime(value, code, nullable = false) {
  if (nullable && value === null) return;
  assert(typeof value === 'string' && Number.isFinite(Date.parse(value)), code);
}

function validateDeclaration(declaration) {
  exactKeys(declaration, [
    'capability_id', 'scope', 'state', 'authorized_by', 'valid_from',
    'expires_at', 'evidence_refs'
  ], 'capabilities_v08_declaration');
  assert(/^[a-z][a-z0-9_.-]+$/.test(declaration.capability_id), 'capabilities_v08_id_invalid');
  assert(['internal', 'external'].includes(declaration.scope), 'capabilities_v08_scope_invalid');
  assert(GENERIC_AUTHORITY_STATES.includes(declaration.state), 'capabilities_v08_state_invalid');
  assert(declaration.authorized_by === null || (typeof declaration.authorized_by === 'string' && declaration.authorized_by.trim()), 'capabilities_v08_authorizer_invalid');
  dateTime(declaration.valid_from, 'capabilities_v08_valid_from_invalid', true);
  dateTime(declaration.expires_at, 'capabilities_v08_expires_at_invalid', true);
  assert(Array.isArray(declaration.evidence_refs) && declaration.evidence_refs.every((item) => typeof item === 'string' && item.trim()), 'capabilities_v08_evidence_invalid');
  if (['standing_human_authorized', 'temporarily_human_authorized'].includes(declaration.state)) {
    assert(declaration.authorized_by !== null, 'capabilities_v08_human_authorizer_required');
  }
}

export function validateCapabilitiesV08(value) {
  exactKeys(value, [
    '$schema', 'schema_version', 'environment_id', 'runtime_capability', 'declarations'
  ], 'capabilities_v08');
  assert(value.$schema === capabilitiesCandidateSchemaUrl(), 'capabilities_v08_schema_identity_invalid');
  assert(value.schema_version === '2.0.0', 'capabilities_v08_schema_version_invalid');
  assert(typeof value.environment_id === 'string' && value.environment_id.length >= 2, 'capabilities_v08_environment_invalid');
  exactKeys(value.runtime_capability, [
    'execution_class', 'evidence_profile', 'assessment_ref',
    'assessment_sha256', 'assessed_at'
  ], 'capabilities_v08_runtime');
  assert(EXECUTION_CLASSES.includes(value.runtime_capability.execution_class), 'capabilities_v08_execution_class_invalid');
  assert(value.runtime_capability.evidence_profile === 'environment-profiles-v1.1.0-candidate', 'capabilities_v08_evidence_profile_invalid');
  assert(typeof value.runtime_capability.assessment_ref === 'string' && value.runtime_capability.assessment_ref.trim(), 'capabilities_v08_assessment_ref_invalid');
  assert(SHA256.test(value.runtime_capability.assessment_sha256), 'capabilities_v08_assessment_digest_invalid');
  dateTime(value.runtime_capability.assessed_at, 'capabilities_v08_assessed_at_invalid');
  assert(Array.isArray(value.declarations), 'capabilities_v08_declarations_invalid');
  value.declarations.forEach(validateDeclaration);
  return value;
}

export function migrateCapabilitiesV07(source, runtimeCapability, options) {
  exactKeys(source, ['$schema', 'schema_version', 'environment_id', 'declarations'], 'capabilities_v07_source');
  assert(source.schema_version === '1.0.0' && Array.isArray(source.declarations), 'capabilities_v07_source_invalid');
  const migrated = {
    $schema: capabilitiesCandidateSchemaUrl(), schema_version: '2.0.0',
    environment_id: source.environment_id,
    runtime_capability: structuredClone(runtimeCapability),
    declarations: source.declarations.map((declaration) => ({
      ...structuredClone(declaration),
      state: V07_AUTHORITY_MAPPING[declaration.state]
    }))
  };
  assert(migrated.declarations.every((declaration) => declaration.state), 'capabilities_v07_state_unmapped');
  validateCapabilitiesV08(migrated);
  const proposal = {
    $schema: capabilitiesCandidateSchemaUrl('v0.7-v0.8-adoption.schema.json'),
    schema_version: '1.0.0', proposal_id: options.proposalId,
    environment_id: source.environment_id,
    source_release: 'communications-v0.7.0', target_release: 'communications-v0.8.0-candidate',
    source_core_digest: options.sourceCoreDigest,
    authority_mapping: [
      { source_state: 'ray_standing_authorized', target_state: 'standing_human_authorized' },
      { source_state: 'ray_temporarily_authorized', target_state: 'temporarily_human_authorized' }
    ],
    proposed_capabilities: migrated,
    preserves_genesis_and_lineage: true,
    adoption_authority_ref: options.adoptionAuthorityRef,
    apply: false,
    proposed_at: options.proposedAt
  };
  validateMigrationProposal(proposal);
  return proposal;
}

export function validateMigrationProposal(proposal) {
  exactKeys(proposal, [
    '$schema', 'schema_version', 'proposal_id', 'environment_id', 'source_release',
    'target_release', 'source_core_digest', 'authority_mapping',
    'proposed_capabilities', 'preserves_genesis_and_lineage',
    'adoption_authority_ref', 'apply', 'proposed_at'
  ], 'capabilities_v08_migration');
  assert(proposal.$schema === capabilitiesCandidateSchemaUrl('v0.7-v0.8-adoption.schema.json'), 'capabilities_v08_migration_schema_invalid');
  assert(proposal.schema_version === '1.0.0', 'capabilities_v08_migration_version_invalid');
  assert(typeof proposal.proposal_id === 'string' && proposal.proposal_id.trim(), 'capabilities_v08_migration_id_invalid');
  assert(proposal.source_release === 'communications-v0.7.0' && proposal.target_release === 'communications-v0.8.0-candidate', 'capabilities_v08_migration_release_invalid');
  assert(SHA256.test(proposal.source_core_digest), 'capabilities_v08_migration_digest_invalid');
  assert(Array.isArray(proposal.authority_mapping) && proposal.authority_mapping.length === 2, 'capabilities_v08_authority_mapping_invalid');
  const authorityMapping = new Map();
  for (const entry of proposal.authority_mapping) {
    exactKeys(entry, ['source_state', 'target_state'], 'capabilities_v08_authority_mapping_entry');
    assert(typeof entry.source_state === 'string' && GENERIC_AUTHORITY_STATES.includes(entry.target_state), 'capabilities_v08_authority_mapping_entry_invalid');
    authorityMapping.set(entry.source_state, entry.target_state);
  }
  assert(authorityMapping.get('ray_standing_authorized') === 'standing_human_authorized', 'capabilities_v08_standing_mapping_invalid');
  assert(authorityMapping.get('ray_temporarily_authorized') === 'temporarily_human_authorized', 'capabilities_v08_temporary_mapping_invalid');
  validateCapabilitiesV08(proposal.proposed_capabilities);
  assert(proposal.environment_id === proposal.proposed_capabilities.environment_id, 'capabilities_v08_migration_environment_mismatch');
  assert(proposal.preserves_genesis_and_lineage === true && proposal.apply === false, 'capabilities_v08_migration_mutation_boundary_invalid');
  assert(typeof proposal.adoption_authority_ref === 'string' && proposal.adoption_authority_ref.trim(), 'capabilities_v08_migration_authority_required');
  dateTime(proposal.proposed_at, 'capabilities_v08_migration_time_invalid');
  return proposal;
}

export function validateOfficialReferencePrincipal(record) {
  exactKeys(record, ['publisher', 'environment_id', 'human_principal'], 'official_reference_principal');
  assert(REPOSITORY.test(record.publisher), 'official_reference_publisher_invalid');
  assert(typeof record.environment_id === 'string' && record.environment_id.trim(), 'official_reference_environment_invalid');
  assert(typeof record.human_principal === 'string' && record.human_principal.trim(), 'official_reference_human_principal_invalid');
  if (record.publisher === 'normsexchange-dev/nx-codex-communications_dev' && record.environment_id.startsWith('ray-reference-')) {
    assert(record.human_principal === 'ray', 'official_ray_principal_must_be_lowercase');
  }
  return record;
}
