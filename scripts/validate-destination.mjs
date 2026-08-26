import path from 'node:path';
import { validateDestination, sanitizedErrorCode } from './lib/destination-core.mjs';

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--') || index + 1 >= argv.length) throw new Error('invalid_arguments');
    options[key.slice(2)] = argv[++index];
  }
  return options;
}

try {
  const options = parseArguments(process.argv.slice(2));
  const root = path.resolve(options.root || '.');
  const result = await validateDestination(root, {
    expectedRepository: options.repository || process.env.NX_COMMUNICATIONS_REPOSITORY || process.env.GITHUB_REPOSITORY,
    expectedEnvironment: options.environment,
    expectedOwner: options.owner,
    expectedRuntime: options.runtime
  });
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(JSON.stringify({ result: 'NO-GO', validator: 'destination', finding: sanitizedErrorCode(error) }));
  process.exitCode = 1;
}
