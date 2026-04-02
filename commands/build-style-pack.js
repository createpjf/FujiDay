#!/usr/bin/env node
const catalog = require('../style-packs/fujifilm/catalog.json');
const adjustmentRules = require('../style-packs/fujifilm/adjustment-rules.json');
const { parseArgs, printJson } = require('./lib/args');

function validateStylePack() {
  if (catalog.family !== 'fujifilm') {
    throw new Error('FujiDay v1 expects the fujifilm family.');
  }
  if (!Array.isArray(catalog.styles) || catalog.styles.length < 7) {
    throw new Error('Style catalog must contain at least seven Fujifilm styles.');
  }

  for (const style of catalog.styles) {
    if (!style.name || !Array.isArray(style.aliases) || !style.default_recipe || !style.preview_preset) {
      throw new Error(`Style entry ${style.name || '<unknown>'} is incomplete.`);
    }
  }

  if (!adjustmentRules.supported_scene_flags?.includes('portrait_priority')) {
    throw new Error('Adjustment rules must declare the v1 scene flags.');
  }

  return {
    status: 'success',
    family: catalog.family,
    version: catalog.version,
    style_count: catalog.styles.length,
    styles: catalog.styles.map(style => style.name),
    scene_flags: adjustmentRules.supported_scene_flags
  };
}

async function run(argv = process.argv.slice(2), io = process) {
  const args = parseArgs(argv);
  if (args.family && args.family !== 'fujifilm') {
    printJson(io, {
      status: 'error',
      error_code: 'INPUT_ERROR',
      message: 'FujiDay v1 only supports --family fujifilm.',
      details: null
    });
    return 1;
  }

  try {
    const result = validateStylePack();
    printJson(io, result);
    return 0;
  } catch (error) {
    printJson(io, {
      status: 'error',
      error_code: 'STYLE_PACK_ERROR',
      message: error.message,
      details: null
    });
    return 1;
  }
}

if (require.main === module) {
  run().then(code => {
    process.exitCode = code;
  });
}

module.exports = {
  run,
  validateStylePack
};
