import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, sanitizedError } from './lib/nx-interface.mjs';

const SECRET_PATTERNS = [
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*["'][^"'<>\s]{8,}["']/i
];
const BROWSER_TOKEN_PATTERN = /(?:localStorage|sessionStorage)[\s\S]{0,160}(?:token|pat|github)|(?:token|pat|github)[\s\S]{0,160}(?:localStorage|sessionStorage)/i;

async function walk(directory, root = directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist', 'build'].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute, root));
    else if (entry.isFile()) files.push({ absolute, relative: path.relative(root, absolute).split(path.sep).join('/') });
  }
  return files;
}

export async function securityReview(root) {
  const findings = [];
  for (const file of await walk(root)) {
    const buffer = await readFile(file.absolute);
    if (buffer.includes(0)) continue;
    const text = buffer.toString('utf8');
    if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) findings.push({ code: 'credential_value_detected', path: file.relative });
    if (BROWSER_TOKEN_PATTERN.test(text)) findings.push({ code: 'browser_token_storage_design', path: file.relative });
    if (/(^|\/)(package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(file.relative)) findings.push({ code: 'dependency_review_required', path: file.relative });
  }
  findings.sort((left, right) => `${left.path}:${left.code}`.localeCompare(`${right.path}:${right.code}`));
  return {
    schema_version: '1.0.0',
    credential_review: findings.some((item) => item.code === 'credential_value_detected') ? 'EXPOSED' : findings.some((item) => item.code === 'browser_token_storage_design') ? 'REVIEW_REQUIRED' : 'CLEAR',
    dependency_review: findings.some((item) => item.code === 'dependency_review_required') ? 'REVIEW_REQUIRED' : 'NOT_REQUIRED',
    findings
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await securityReview(path.resolve(args.root || '.'));
  console.log(JSON.stringify(result, null, 2));
  if (result.credential_review === 'EXPOSED') process.exitCode = 2;
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`SECURITY REVIEW ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
}
