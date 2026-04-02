#!/usr/bin/env node
const runtime = require('../runtimes/photo-color-runtime');
const { parseArgs, printJson } = require('./lib/args');

async function run(argv = process.argv.slice(2), io = process) {
  const args = parseArgs(argv);
  const styles = typeof args.styles === 'string'
    ? args.styles.split(',').map(value => value.trim()).filter(Boolean)
    : [];

  if (styles.length === 0 && !args.goal && !args.image) {
    printJson(io, {
      status: 'error',
      error_code: 'INPUT_ERROR',
      message: 'Provide --styles, --goal, or --image.',
      details: null
    });
    return 1;
  }

  const result = await runtime.compare_styles({
    image_path: typeof args.image === 'string' ? args.image : null,
    styles,
    textual_goal: typeof args.goal === 'string' ? args.goal : null
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
