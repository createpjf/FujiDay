#!/usr/bin/env node
const runtime = require('../index.js');
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

  const compositionStyle = typeof args['composition-style'] === 'string' ? args['composition-style'] : 'alex-webb';

  if (!args.mode) {
    const analysis = await runtime.analyze_composition({
      image_path: args.image,
      composition_style: compositionStyle
    });
    if (analysis.status === 'error') {
      printJson(io, analysis);
      return 1;
    }
    if (
      analysis.analysis_provider === 'disabled' ||
      !analysis.composition_observation?.crop_candidates
    ) {
      printJson(io, {
        status: 'error',
        error_code: 'VLM_REQUIRED_FOR_CROP_EXPORT',
        message: 'Composition-to-Fujifilm export requires a VLM-capable provider.',
        details: {
          composition_observation: analysis.composition_observation
        }
      });
      return 1;
    }

    printJson(io, {
      status: 'selection_required',
      composition_style: compositionStyle,
      composition_observation: analysis.composition_observation,
      crop_modes: analysis.recommended_crop_modes,
      prompt: 'Choose one crop mode by name before composing with a Fujifilm style.'
    });
    return 0;
  }

  const result = await runtime.compose_fujifilm({
    image_path: args.image,
    composition_style: compositionStyle,
    crop_mode: args.mode,
    selected_style: typeof args['fujifilm-style'] === 'string' ? args['fujifilm-style'] : null,
    output_path: typeof args.output === 'string' ? args.output : null
  });

  printJson(io, result);
  return result.status === 'success' ? 0 : result.status === 'selection_required' ? 0 : 1;
}

if (require.main === module) {
  run().then(code => {
    process.exitCode = code;
  });
}

module.exports = { run };
