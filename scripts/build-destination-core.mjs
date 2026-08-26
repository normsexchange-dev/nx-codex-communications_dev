import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADAPTABLE_MANIFEST_FIELDS,
  ALLOWED_DESTINATION_PATHS,
  GENERATED_PATHS,
  SOURCE_REPOSITORY,
  STATIC_PATHS,
  TAG,
  VALIDATOR_VERSION,
  immutableManifest,
  readJson,
  sha256,
  stableStringify
} from './lib/destination-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'destination-core-template.json');

export async function buildTemplate(sourceRoot = root) {
  const manifest = await readJson(path.join(sourceRoot, 'agent-manifest.json'));
  const staticFiles = [];
  for (const relativePath of STATIC_PATHS) staticFiles.push({ path: relativePath, sha256: sha256(await readFile(path.join(sourceRoot, relativePath))) });
  return {
    schema_version: '1.0.0',
    validator_version: VALIDATOR_VERSION,
    source: { repository: SOURCE_REPOSITORY, release: TAG, tag_ref: `refs/tags/${TAG}`, tag_object_type: 'tag', tag_target_type: 'commit' },
    destination: {
      allowed_paths: ALLOWED_DESTINATION_PATHS,
      static_files: staticFiles,
      generated_paths: GENERATED_PATHS,
      adaptable_manifest_fields: ADAPTABLE_MANIFEST_FIELDS,
      immutable_manifest: immutableManifest(manifest)
    }
  };
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] || '--check';
  const expected = `${JSON.stringify(await buildTemplate(), null, 2)}\n`;
  if (mode === '--write') await writeFile(target, expected, 'utf8');
  else if (mode === '--check') {
    const actual = await readFile(target, 'utf8');
    if (stableStringify(JSON.parse(actual)) !== stableStringify(JSON.parse(expected))) throw new Error('destination-core-template.json is stale');
  } else throw new Error('use --write or --check');
  console.log(`destination-core-template: ${mode === '--write' ? 'WRITTEN' : 'GO'} (${STATIC_PATHS.length} static; ${ALLOWED_DESTINATION_PATHS.length} total)`);
}
