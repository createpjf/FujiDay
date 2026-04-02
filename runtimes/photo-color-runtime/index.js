const { readConfig } = require('./lib/config');
const { FujiDayError, toErrorResult } = require('./lib/errors');
const { readAndValidateImage, handleDeletion, normalizeFormat, writeOutputImage } = require('./lib/image-io');
const { analyzeImageObservation } = require('./lib/observer');
const { renderApproximationBuffer, generatePreviewDataUri } = require('./lib/preview');
const {
  normalizeSelectedStyle,
  listStyles,
  buildRecipeFromObservation,
  compareStyleSet
} = require('./lib/style-pack');

async function analyze_image({ image_path } = {}) {
  try {
    const config = readConfig();
    const { buffer, metadata } = await readAndValidateImage(image_path, config.maxImageBytes);
    const observation = await analyzeImageObservation({
      imageBuffer: buffer,
      imagePath: image_path,
      width: metadata.width,
      height: metadata.height,
      provider: config.vlmProvider,
      baseUrl: config.vlmBaseUrl,
      model: config.vlmModel,
      timeoutMs: config.vlmTimeoutMs,
      maxRetries: config.vlmMaxRetries,
      apiKey: config.vlmApiKey,
      minimaxMcpCommand: config.minimaxMcpCommand,
      minimaxMcpArgs: config.minimaxMcpArgs,
      minimaxMcpBasePath: config.minimaxMcpBasePath,
      minimaxApiResourceMode: config.minimaxApiResourceMode
    });

    return {
      status: 'success',
      analysis_provider: observation.analysis_provider,
      image_observation: observation,
      recommended_styles: listStyles({ imageObservation: observation }).styles
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

function list_styles({ image_observation, family = 'fujifilm', textual_goal = '' } = {}) {
  try {
    return {
      status: 'success',
      ...listStyles({ imageObservation: image_observation, family, textualGoal: textual_goal })
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

async function generate_recipe({ image_path, selected_style, output_preview, delete_after = false } = {}) {
  try {
    if (typeof delete_after !== 'boolean') {
      throw new FujiDayError('INPUT_ERROR', 'delete_after must be a boolean.');
    }
    if (output_preview !== undefined && typeof output_preview !== 'boolean') {
      throw new FujiDayError('INPUT_ERROR', 'output_preview must be a boolean when provided.');
    }

    const config = readConfig();
    const normalizedStyle = normalizeSelectedStyle(selected_style);
    if (!normalizedStyle) {
      throw new FujiDayError('INPUT_ERROR', 'selected_style must be a supported Fujifilm style.');
    }

    const { buffer, metadata } = await readAndValidateImage(image_path, config.maxImageBytes);

    const observation = await analyzeImageObservation({
      imageBuffer: buffer,
      imagePath: image_path,
      width: metadata.width,
      height: metadata.height,
      provider: config.vlmProvider,
      baseUrl: config.vlmBaseUrl,
      model: config.vlmModel,
      timeoutMs: config.vlmTimeoutMs,
      maxRetries: config.vlmMaxRetries,
      apiKey: config.vlmApiKey,
      minimaxMcpCommand: config.minimaxMcpCommand,
      minimaxMcpArgs: config.minimaxMcpArgs,
      minimaxMcpBasePath: config.minimaxMcpBasePath,
      minimaxApiResourceMode: config.minimaxApiResourceMode
    });

    const built = buildRecipeFromObservation(normalizedStyle, observation);
    const shouldRenderPreview = output_preview === undefined ? config.defaultOutputPreview : output_preview;
    let previewImageDataUri = null;

    if (shouldRenderPreview) {
      try {
        previewImageDataUri = await generatePreviewDataUri(buffer, built.previewPreset, observation);
      } catch (error) {
        throw new FujiDayError('PREVIEW_RENDER_ERROR', `Unable to generate preview image: ${error.message}`);
      }
    }

    const deletionStatus = await handleDeletion(image_path, delete_after);

    return {
      status: 'success',
      analysis_provider: observation.analysis_provider,
      selected_style: normalizedStyle,
      selected_target_style: normalizedStyle,
      image_observation: observation,
      recipe: built.recipe,
      rationale: built.rationale,
      best_use_cases: built.bestUseCases,
      failure_cases: built.failureCases,
      compatibility_notes: built.compatibilityNotes,
      next_test_to_run: built.nextTestToRun,
      preview_note: shouldRenderPreview
        ? 'Approximate preview only; this is not a camera-exact Fujifilm JPEG render.'
        : 'Preview not requested.',
      preview_image_data_uri: previewImageDataUri,
      export_path: null,
      source_file_deletion: deletionStatus.source_file_deletion,
      source_file_deletion_message: deletionStatus.source_file_deletion_message
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

async function export_render({
  image_path,
  selected_style,
  recipe_override = null,
  format = 'jpg',
  output_path = null,
  image_observation = null
} = {}) {
  try {
    const config = readConfig();
    const normalizedStyle = normalizeSelectedStyle(selected_style);
    if (!normalizedStyle) {
      throw new FujiDayError('INPUT_ERROR', 'selected_style must be a supported Fujifilm style.');
    }
    if (image_observation !== null && (typeof image_observation !== 'object' || Array.isArray(image_observation))) {
      throw new FujiDayError('INPUT_ERROR', 'image_observation must be an object when provided.');
    }

    const finalFormat = normalizeFormat(format, output_path);
    const { buffer, metadata } = await readAndValidateImage(image_path, config.maxImageBytes);
    const observation = image_observation || await analyzeImageObservation({
      imageBuffer: buffer,
      imagePath: image_path,
      width: metadata.width,
      height: metadata.height,
      provider: config.vlmProvider,
      baseUrl: config.vlmBaseUrl,
      model: config.vlmModel,
      timeoutMs: config.vlmTimeoutMs,
      maxRetries: config.vlmMaxRetries,
      apiKey: config.vlmApiKey,
      minimaxMcpCommand: config.minimaxMcpCommand,
      minimaxMcpArgs: config.minimaxMcpArgs,
      minimaxMcpBasePath: config.minimaxMcpBasePath,
      minimaxApiResourceMode: config.minimaxApiResourceMode
    });

    const built = buildRecipeFromObservation(normalizedStyle, observation);
    const recipe = recipe_override && typeof recipe_override === 'object'
      ? { ...built.recipe, ...recipe_override }
      : built.recipe;

    let renderedBuffer;
    try {
      renderedBuffer = await renderApproximationBuffer(buffer, built.previewPreset, observation, finalFormat);
    } catch (error) {
      throw new FujiDayError('EXPORT_RENDER_ERROR', `Unable to render export image: ${error.message}`);
    }

    const exportedPath = await writeOutputImage({
      imagePath: image_path,
      outputPath: output_path,
      format: finalFormat,
      selectedStyle: normalizedStyle,
      buffer: renderedBuffer
    });

    return {
      status: 'success',
      analysis_provider: observation.analysis_provider || null,
      selected_style: normalizedStyle,
      selected_target_style: normalizedStyle,
      image_observation: observation,
      recipe,
      rationale: built.rationale,
      best_use_cases: built.bestUseCases,
      failure_cases: built.failureCases,
      compatibility_notes: built.compatibilityNotes,
      next_test_to_run: built.nextTestToRun,
      preview_note: 'Approximate preview only; this is not a camera-exact Fujifilm JPEG render.',
      preview_image_data_uri: null,
      export_path: exportedPath,
      source_file_deletion: 'disabled',
      source_file_deletion_message: null
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

async function compare_styles({ image_path = null, styles, textual_goal = null } = {}) {
  try {
    let observation = null;
    let normalizedStyles = styles;

    if (Array.isArray(styles) && styles.length > 0) {
      const requested = styles.map(style => ({
        raw: style,
        normalized: normalizeSelectedStyle(style)
      }));
      const invalid = requested.filter(item => !item.normalized).map(item => item.raw);
      if (invalid.length > 0) {
        throw new FujiDayError('INPUT_ERROR', `Unknown Fujifilm style(s): ${invalid.join(', ')}.`);
      }
      normalizedStyles = requested.map(item => item.normalized);
    }

    if (image_path) {
      const config = readConfig();
      const { buffer, metadata } = await readAndValidateImage(image_path, config.maxImageBytes);
      observation = await analyzeImageObservation({
        imageBuffer: buffer,
        imagePath: image_path,
        width: metadata.width,
        height: metadata.height,
        provider: config.vlmProvider,
        baseUrl: config.vlmBaseUrl,
        model: config.vlmModel,
        timeoutMs: config.vlmTimeoutMs,
        maxRetries: config.vlmMaxRetries,
        apiKey: config.vlmApiKey,
        minimaxMcpCommand: config.minimaxMcpCommand,
        minimaxMcpArgs: config.minimaxMcpArgs,
        minimaxMcpBasePath: config.minimaxMcpBasePath,
        minimaxApiResourceMode: config.minimaxApiResourceMode
      });
    }

    const comparison = compareStyleSet({
      styles: normalizedStyles,
      imageObservation: observation,
      textualGoal: textual_goal || ''
    });

    const selectedStyle = comparison.recommended_style;
    const built = selectedStyle ? buildRecipeFromObservation(selectedStyle, comparison.image_observation) : null;

    return {
      status: 'success',
      analysis_provider: comparison.image_observation?.analysis_provider || (textual_goal ? 'textual_goal' : null),
      selected_style: selectedStyle,
      selected_target_style: selectedStyle,
      image_observation: comparison.image_observation,
      recipe: built?.recipe || null,
      rationale: built
        ? `${built.rationale} Compared styles: ${comparison.comparisons.map(item => item.name).join(', ')}.`
        : 'No valid style comparison could be produced.',
      best_use_cases: built?.bestUseCases || [],
      failure_cases: built?.failureCases || [],
      compatibility_notes: built?.compatibilityNotes || '',
      next_test_to_run: built?.nextTestToRun || 'Run a single-scene comparison across the requested styles.',
      preview_note: 'Preview not requested.',
      preview_image_data_uri: null,
      export_path: null,
      source_file_deletion: 'disabled',
      source_file_deletion_message: null,
      comparisons: comparison.comparisons
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

async function execute({ image_path, selected_style, delete_after = false, output_preview = false } = {}) {
  return generate_recipe({
    image_path,
    selected_style,
    delete_after,
    output_preview
  });
}

module.exports = {
  name: 'fujiday_photo_color_runtime',
  description: 'Analyze a photo, list Fujifilm styles, generate recipes, compare looks, render previews, and export approximate graded images.',
  analyze_image,
  list_styles,
  generate_recipe,
  export_render,
  compare_styles,
  execute,
  __private: {
    normalizeSelectedStyle,
    listStyles,
    buildRecipeFromObservation,
    compareStyleSet,
    readAndValidateImage,
    analyzeImageObservation,
    renderApproximationBuffer
  }
};
