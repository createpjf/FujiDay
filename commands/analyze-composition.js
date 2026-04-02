#!/usr/bin/env node
const runtime = require('../runtimes/photo-composition-runtime');
const { parseArgs, printJson } = require('./lib/args');

async function run(argv = process.argv.slice(2), io = process) {
  const args = parseArgs(argv);

  if (!args.image) {
    printJson(io, {
      status: 'error',
      error_code: 'INPUT_ERROR',
      message: '--image is required.',
      details: null
    });
    return 1;
  }

  const result = await runtime.analyze_composition({
    image_path: args.image,
    composition_style: typeof args['composition-style'] === 'string' ? args['composition-style'] : 'alex-webb'
  });
  printJson(io, result);
  return result.status === 'success' ? 0 : 1;
}

if (require.main === module) {
  run().then(code => {
    process.exitCode = code;
  });
}

module.exports = { run };
