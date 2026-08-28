import https from 'node:https';

import { parseArgs, sanitizedError } from './lib/nx-interface.mjs';
import { evaluateReaderPermissions } from './lib/pairwise-channel.mjs';

function request(repository, token) {
  return new Promise((resolve, reject) => {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'nx-pairwise-reader-verifier', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const request = https.request({ hostname: 'api.github.com', path: `/repos/${repository}`, method: 'GET', headers }, (response) => {
      let body = '';
      response.setEncoding('utf8'); response.on('data', (chunk) => { body += chunk; });
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
  if (!options.repository) throw new Error('missing_repository');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(options.repository)) throw new Error('repository_invalid');
  const response = await request(options.repository, process.env.GITHUB_TOKEN || null);
  const result = evaluateReaderPermissions({
    pull: response.permissions?.pull === true, push: response.permissions?.push === true,
    admin: response.permissions?.admin === true, maintain: response.permissions?.maintain === true,
    triage: response.permissions?.triage === true
  });
  console.log(JSON.stringify({ ...result, repository: options.repository }));
  if (result.status !== 'READ_ONLY_VERIFIED') process.exitCode = 3;
}

main().catch((error) => { console.error(`PAIRWISE ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
