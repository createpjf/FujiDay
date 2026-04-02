#!/usr/bin/env node
const runtime = require('../runtimes/photo-color-runtime');
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

  if (!args.style) {
    const analysis = await runtime.analyze_image({ image_path: args.image });
    if (analysis.status === 'error') {
      printJson(io, analysis);
      return 1;
    }

    const menu = runtime.list_styles({ image_observation: analysis.image_observation, family: 'fujifilm' });
    printJson(io, {
      status: 'selection_required',
      image_observation: analysis.image_observation,
      styles: menu.styles,
      prompt: 'Choose one Fujifilm style by name before generating the recipe.'
    });
    return 0;
  }

  const result = await runtime.generate_recipe({
    image_path: args.image,
    selected_style: args.style,
    output_preview: args.preview === true,
    delete_after: args['delete-after'] === true
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
