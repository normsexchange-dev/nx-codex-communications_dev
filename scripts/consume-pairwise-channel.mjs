import { mkdir, writeFile } from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';

import { assert, parseArgs, sanitizedError } from './lib/nx-interface.mjs';
import { validateChannelRoot } from './lib/pairwise-channel.mjs';

function githubJson(apiPath, token) {
  return new Promise((resolve, reject) => {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'nx-pairwise-read-only-consumer', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const request = https.request({ hostname: 'api.github.com', path: apiPath, method: 'GET', headers }, (response) => {
      let body = ''; response.setEncoding('utf8'); response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode !== 200) return reject(new Error(`github_status_${response.statusCode}`));
        try { resolve(JSON.parse(body)); } catch { reject(new Error('github_response_invalid')); }
      });
    });
    request.on('error', () => reject(new Error('github_request_failed'))); request.end();
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  for (const key of ['repository', 'commit', 'output']) if (!options[key]) throw new Error(`missing_${key}`);
  assert(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(options.repository), 'repository_invalid');
  assert(/^[a-f0-9]{40}$/.test(options.commit), 'commit_invalid');
  const output = path.resolve(options.output);
  const token = process.env.GITHUB_TOKEN || null;
  const tree = await githubJson(`/repos/${options.repository}/git/trees/${options.commit}?recursive=1`, token);
  assert(tree.truncated === false, 'remote_tree_truncated');
  const allowed = /^(?:CHANNEL_VERSION|channel\/manifest\.json|outbound\/index\.json|messages\/[A-Za-z0-9._-]+\.json|payloads\/[A-Za-z0-9._\/-]+\.json)$/;
  const blobs = tree.tree.filter((entry) => entry.type === 'blob' && allowed.test(entry.path));
  assert(blobs.some((entry) => entry.path === 'channel/manifest.json') && blobs.some((entry) => entry.path === 'outbound/index.json'), 'remote_channel_core_missing');
  for (const entry of blobs) {
    const blob = await githubJson(`/repos/${options.repository}/git/blobs/${entry.sha}`, token);
    assert(blob.encoding === 'base64', 'remote_blob_encoding_invalid');
    const destination = path.join(output, ...entry.path.split('/'));
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, Buffer.from(blob.content.replace(/\s/g, ''), 'base64'), { flag: 'wx' });
  }
  const result = await validateChannelRoot(output);
  console.log(JSON.stringify({ status: 'CONSUMED_READ_ONLY', repository: options.repository, commit: options.commit, channel_id: result.manifest.channel_id, messages: result.index.messages.length }));
}

main().catch((error) => { console.error(`PAIRWISE ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
