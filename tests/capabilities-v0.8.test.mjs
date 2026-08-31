import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  GENERIC_AUTHORITY_STATES, migrateCapabilitiesV07,
  validateCapabilitiesV08, validateOfficialReferencePrincipal
} from '../scripts/lib/capabilities-v0.8.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeCapability = {
  execution_class: 'interactive-tool',
  evidence_profile: 'example-runtime-evidence-profile',
  assessment_ref: 'environment-local/runtime-capability.json',
  assessment_sha256: 'a'.repeat(64),
  assessed_at: '2030-01-01T00:00:00.000Z'
};

function v07Capabilities() {
  return {
    $schema: 'https://raw.githubusercontent.com/normsexchange-dev/nx-codex-communications_dev/communications-v0.7.0/schemas/nx-capabilities.schema.json',
    schema_version: '1.0.0', environment_id: 'example-environment',
    declarations: [
      {
        capability_id: 'research.public', scope: 'internal',
        state: 'ray_standing_authorized', authorized_by: 'example-human',
        valid_from: '2030-01-01T00:00:00.000Z', expires_at: null,
        evidence_refs: ['example-authority-record']
      },
      {
        capability_id: 'repository.write', scope: 'external',
        state: 'ray_temporarily_authorized', authorized_by: 'example-human',
        valid_from: '2030-01-01T00:00:00.000Z',
        expires_at: '2030-01-01T01:00:00.000Z', evidence_refs: ['example-goal']
      }
    ]
  };
}

test('v0.8 authority vocabulary is generic and runtime evidence is structural', async () => {
  assert.ok(GENERIC_AUTHORITY_STATES.includes('standing_human_authorized'));
  assert.ok(GENERIC_AUTHORITY_STATES.includes('temporarily_human_authorized'));
  assert.equal(GENERIC_AUTHORITY_STATES.some((item) => item.startsWith('ray_')), false);
  const schema = await readFile(path.join(root, 'schemas/nx-capabilities-v0.8.schema.json'), 'utf8');
  assert.equal(schema.includes('ray_standing_authorized'), false);
  assert.ok(schema.includes('runtime_capability'));
  assert.ok(schema.includes('persistent-execution'));
});

test('v0.7 adoption maps old authority names without rewriting genesis or applying', () => {
  const proposal = migrateCapabilitiesV07(v07Capabilities(), runtimeCapability, {
    proposalId: 'proposal-example-v07-v08', sourceCoreDigest: 'b'.repeat(64),
    adoptionAuthorityRef: 'example-owner-decision', proposedAt: '2030-01-01T00:10:00.000Z'
  });
  assert.deepEqual(proposal.proposed_capabilities.declarations.map((item) => item.state), [
    'standing_human_authorized', 'temporarily_human_authorized'
  ]);
  assert.equal(proposal.preserves_genesis_and_lineage, true);
  assert.equal(proposal.apply, false);
  assert.deepEqual(proposal.authority_mapping.map((item) => item.target_state), [
    'standing_human_authorized', 'temporarily_human_authorized'
  ]);
  assert.equal(proposal.source_release, 'communications-v0.7.0');
  assert.equal(proposal.target_release, 'communications-v0.8.0');
  assert.equal(validateCapabilitiesV08(proposal.proposed_capabilities), proposal.proposed_capabilities);
});

test('unmapped historical states fail closed', () => {
  const source = v07Capabilities();
  source.declarations[0].state = 'invented_authority';
  assert.throws(() => migrateCapabilitiesV07(source, runtimeCapability, {
    proposalId: 'proposal-example-invalid', sourceCoreDigest: 'b'.repeat(64),
    adoptionAuthorityRef: 'example-owner-decision', proposedAt: '2030-01-01T00:10:00.000Z'
  }), /capabilities_v07_state_unmapped/);
});

test('official Ray reference principal is exactly lowercase while the public schema stays generic', async () => {
  const official = JSON.parse(await readFile(path.join(root, 'tests/fixtures/official-ray-reference-principal.json'), 'utf8'));
  assert.equal(validateOfficialReferencePrincipal(official), official);
  assert.throws(() => validateOfficialReferencePrincipal({ ...official, human_principal: 'Ray' }), /official_ray_principal_must_be_lowercase/);
  assert.doesNotThrow(() => validateOfficialReferencePrincipal({
    publisher: 'example-owner/example-repository', environment_id: 'example-reference',
    human_principal: 'another-person'
  }));
});

test('v0.8 core schema is release-bound and immutable v0.7 recognition remains supported', async () => {
  const currentSchema = JSON.parse(await readFile(path.join(root, 'schemas/nx-capabilities.schema.json'), 'utf8'));
  assert.match(currentSchema.$id, /communications-v0\.8\.0/);
  assert.ok(currentSchema.properties.declarations.items.properties.state.enum.includes('ray_standing_authorized'));
  const verifier = await readFile(path.join(root, 'scripts/verify-interface.mjs'), 'utf8');
  assert.ok(verifier.includes('SUPPORTED_GENESIS_RELEASES'));
  assert.ok(verifier.includes("'communications-v0.7.0'"));
});
