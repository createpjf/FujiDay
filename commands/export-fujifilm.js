#!/usr/bin/env node
const runtime = require('../runtimes/photo-color-runtime');
const { parseArgs, printJson } = require('./lib/args');

async function run(argv = process.argv.slice(2), io = process) {
  const args = parseArgs(argv);

  if (!args.image || !args.style) {
    printJson(io, {
      status: 'error',
      error_code: 'INPUT_ERROR',
      message: '--image and --style are required.',
      details: null
    });
    return 1;
  }

  const result = await runtime.export_render({
    image_path: args.image,
    selected_style: args.style,
    format: typeof args.format === 'string' ? args.format : 'jpg',
    output_path: typeof args.output === 'string' ? args.output : null
  });
  printJson(io, result);
  return result.status === 'success' ? 0 : 1;
}

if (require.main === module) {
  run().then(code => {
    process.exitCode = code;
  });
}

module.exports = {
  run
};
