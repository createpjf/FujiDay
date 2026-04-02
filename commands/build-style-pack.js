#!/usr/bin/env node
const fujifilmCatalog = require('../style-packs/fujifilm/catalog.json');
const adjustmentRules = require('../style-packs/fujifilm/adjustment-rules.json');
const compositionCatalog = require('../style-packs/composition/alex-webb/catalog.json');
const cropModes = require('../style-packs/composition/alex-webb/crop-modes.json');
const scoringRules = require('../style-packs/composition/alex-webb/scoring-rules.json');
const { parseArgs, printJson } = require('./lib/args');

function validateFujifilmStylePack() {
  if (fujifilmCatalog.family !== 'fujifilm') {
    throw new Error('FujiDay v1 expects the fujifilm family.');
  }
  if (!Array.isArray(fujifilmCatalog.styles) || fujifilmCatalog.styles.length < 7) {
    throw new Error('Style catalog must contain at least seven Fujifilm styles.');
  }

  for (const style of fujifilmCatalog.styles) {
    if (!style.name || !Array.isArray(style.aliases) || !style.default_recipe || !style.preview_preset) {
      throw new Error(`Style entry ${style.name || '<unknown>'} is incomplete.`);
    }
  }

  if (!adjustmentRules.supported_scene_flags?.includes('portrait_priority')) {
    throw new Error('Adjustment rules must declare the v1 scene flags.');
  }

  return {
    family: fujifilmCatalog.family,
    version: fujifilmCatalog.version,
    style_count: fujifilmCatalog.styles.length,
    styles: fujifilmCatalog.styles.map(style => style.name),
    scene_flags: adjustmentRules.supported_scene_flags
  };
}

function validateCompositionStylePack() {
  if (compositionCatalog.family !== 'composition') {
    throw new Error('Composition catalog must declare the composition family.');
  }
  if (!Array.isArray(compositionCatalog.styles) || compositionCatalog.styles.length < 1) {
    throw new Error('Composition catalog must contain at least one composition style.');
  }
  if (!Array.isArray(cropModes.modes) || cropModes.modes.length < 3) {
    throw new Error('Composition crop mode catalog must contain at least three modes.');
  }
  if (!scoringRules.enum_weights || !scoringRules.crop_mode_weights) {
    throw new Error('Composition scoring rules are incomplete.');
  }

  return {
    family: compositionCatalog.family,
    version: compositionCatalog.version,
    style_count: compositionCatalog.styles.length,
    styles: compositionCatalog.styles.map(style => style.name),
    crop_mode_count: cropModes.modes.length,
    crop_modes: cropModes.modes.map(mode => mode.name)
  };
}

function validateStylePack(family = 'all') {
  const families = family === 'all' ? ['fujifilm', 'composition'] : [family];
  const results = [];

  for (const item of families) {
    if (item === 'fujifilm') {
      results.push(validateFujifilmStylePack());
      continue;
    }
    if (item === 'composition') {
      results.push(validateCompositionStylePack());
      continue;
    }
    throw new Error(`Unsupported family ${item}.`);
  }

  return {
    status: 'success',
    families: results
  };
}

async function run(argv = process.argv.slice(2), io = process) {
  const args = parseArgs(argv);
  if (args.family && !['fujifilm', 'composition', 'all'].includes(args.family)) {
    printJson(io, {
      status: 'error',
      error_code: 'INPUT_ERROR',
      message: 'FujiDay v1 supports --family fujifilm, composition, or all.',
      details: null
    });
    return 1;
  }

  try {
    const result = validateStylePack(typeof args.family === 'string' ? args.family : 'all');
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
  validateFujifilmStylePack,
  validateCompositionStylePack,
  validateStylePack
};
