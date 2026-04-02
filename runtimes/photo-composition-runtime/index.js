const fs = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');

const { readConfig } = require('../photo-color-runtime/lib/config');
const { FujiDayError, toErrorResult } = require('../photo-color-runtime/lib/errors');
const { readAndValidateImage } = require('../photo-color-runtime/lib/image-io');
const { analyzeCompositionObservation } = require('./lib/observer');
const {
  normalizeCompositionStyle,
  normalizeCropMode,
  normalizeObservation,
  listCropModes
} = require('./lib/style-pack');

const colorRuntime = require('../photo-color-runtime');
const colorObserver = require('../photo-color-runtime/lib/observer');

function resolveCropMode(mode) {
  if (mode === undefined || mode === null || mode === '') {
    return 'balanced';
  }

  const normalized = normalizeCropMode(mode);
  if (!normalized) {
    throw new FujiDayError('INPUT_ERROR', 'crop_mode must be balanced, narrative, or webb_risky.');
  }

  return normalized;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizedToPixels(coordsNorm, width, height) {
  const [x0, y0, x1, y1] = coordsNorm;
  const left = clamp(Math.round(x0 * width), 0, width - 1);
  const top = clamp(Math.round(y0 * height), 0, height - 1);
  const right = clamp(Math.round(x1 * width), left + 1, width);
  const bottom = clamp(Math.round(y1 * height), top + 1, height);

  return {
    left,
    top,
    width: right - left,
    height: bottom - top
  };
}

function normalizeCropPlan(candidate, width, height) {
  const cropPixels = normalizedToPixels(candidate.coords_norm, width, height);
  return {
    coords_norm: candidate.coords_norm,
    crop_pixels: cropPixels,
    aspect_ratio: candidate.aspect_ratio,
    rationale: candidate.rationale,
    secondary_crops: (candidate.secondary_crops || []).map(item => ({
      coords_norm: item.coords_norm,
      crop_pixels: normalizedToPixels(item.coords_norm, width, height),
      aspect_ratio: item.aspect_ratio,
      rationale: item.rationale
    }))
  };
}

async function cropBuffer(buffer, cropPlan) {
  return sharp(buffer)
    .extract(cropPlan.crop_pixels)
    .jpeg({ quality: 92 })
    .toBuffer();
}

function defaultCropOutputPath(imagePath, compositionStyle, cropMode) {
  const dir = path.dirname(imagePath);
  const base = path.basename(imagePath, path.extname(imagePath));
  return path.join(dir, `${base}.${slugify(compositionStyle)}.${slugify(cropMode)}.jpg`);
}

function defaultComposeOutputPath(imagePath, compositionStyle, cropMode, selectedStyle) {
  const dir = path.dirname(imagePath);
  const base = path.basename(imagePath, path.extname(imagePath));
  return path.join(
    dir,
    `${base}.${slugify(compositionStyle)}.${slugify(cropMode)}.${slugify(selectedStyle)}.jpg`
  );
}

async function recommendFujifilmStylesFromBuffer(buffer, config) {
  const metadata = await sharp(buffer).metadata();
  let tmpDir = null;

  try {
    let imagePath = null;

    if (config.vlmProvider === 'minimax') {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-minimax-crop-'));
      imagePath = path.join(tmpDir, 'crop.jpg');
      await fs.writeFile(imagePath, buffer);
    }

    const observation = await colorObserver.analyzeImageObservation({
      imageBuffer: buffer,
      imagePath,
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
    const styles = colorRuntime.list_styles({
      image_observation: observation,
      family: 'fujifilm'
    }).styles.slice(0, 3);

    return {
      observation,
      styles
    };
  } finally {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function analyze_composition({ image_path, composition_style = 'alex-webb' } = {}) {
  try {
    const config = readConfig();
    const normalizedStyle = normalizeCompositionStyle(composition_style);
    if (!normalizedStyle) {
      throw new FujiDayError('INPUT_ERROR', 'composition_style must be a supported composition style.');
    }

    const { buffer, metadata } = await readAndValidateImage(image_path, config.maxImageBytes);
    const observation = await analyzeCompositionObservation({
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

    const recommended = list_crop_modes({
      composition_observation: observation,
      composition_style: normalizedStyle
    });

    return {
      status: 'success',
      analysis_provider: observation.analysis_provider,
      composition_style: normalizedStyle,
      composition_observation: observation,
      webb_fit: observation.webb_fit,
      recommended_crop_modes: recommended.crop_modes
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

function list_crop_modes({ composition_observation, composition_style = 'alex-webb' } = {}) {
  try {
    const normalizedStyle = normalizeCompositionStyle(composition_style);
    if (!normalizedStyle) {
      throw new FujiDayError('INPUT_ERROR', 'composition_style must be a supported composition style.');
    }

    const result = listCropModes({
      compositionObservation: normalizeObservation(composition_observation),
      compositionStyle: normalizedStyle
    });

    return {
      status: 'success',
      ...result
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

async function buildCropRecommendation({
  image_path,
  composition_style = 'alex-webb',
  crop_mode = 'balanced',
  disabled_error_code = 'VLM_REQUIRED_FOR_CROP_RECOMMENDATION',
  disabled_error_message = 'Crop recommendation requires a VLM-capable provider.'
} = {}) {
  const config = readConfig();
  const normalizedStyle = normalizeCompositionStyle(composition_style);
  if (!normalizedStyle) {
    throw new FujiDayError('INPUT_ERROR', 'composition_style must be a supported composition style.');
  }
  if (config.vlmProvider === 'disabled') {
    throw new FujiDayError(disabled_error_code, disabled_error_message);
  }

  const normalizedMode = resolveCropMode(crop_mode);
  const { buffer, metadata } = await readAndValidateImage(image_path, config.maxImageBytes);
  const observation = await analyzeCompositionObservation({
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

  if (observation.analysis_provider === 'disabled' || !observation.crop_candidates) {
    throw new FujiDayError(disabled_error_code, disabled_error_message);
  }

  const candidate = observation.crop_candidates?.[normalizedMode];
  if (!candidate) {
    throw new FujiDayError('VLM_SCHEMA_ERROR', `Composition analysis did not return a ${normalizedMode} crop candidate.`);
  }

  const cropPlan = normalizeCropPlan(candidate, metadata.width, metadata.height);
  const croppedBuffer = await cropBuffer(buffer, cropPlan);
  const fujifilm = await recommendFujifilmStylesFromBuffer(croppedBuffer, config);

  return {
    analysis_provider: observation.analysis_provider,
    composition_style: normalizedStyle,
    composition_observation: observation,
    selected_crop_mode: normalizedMode,
    crop_plan: cropPlan,
    recommended_fujifilm_styles: fujifilm.styles,
    fujifilm_image_observation: fujifilm.observation,
    cropped_buffer: croppedBuffer
  };
}

async function recommend_crop({ image_path, composition_style = 'alex-webb', crop_mode = 'balanced' } = {}) {
  try {
    const result = await buildCropRecommendation({ image_path, composition_style, crop_mode });
    return {
      status: 'success',
      analysis_provider: result.analysis_provider,
      composition_style: result.composition_style,
      composition_observation: result.composition_observation,
      selected_crop_mode: result.selected_crop_mode,
      crop_plan: result.crop_plan,
      recommended_fujifilm_styles: result.recommended_fujifilm_styles
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

async function export_crop({ image_path, composition_style = 'alex-webb', crop_mode = 'balanced', output_path = null } = {}) {
  try {
    const result = await buildCropRecommendation({
      image_path,
      composition_style,
      crop_mode,
      disabled_error_code: 'VLM_REQUIRED_FOR_CROP_EXPORT',
      disabled_error_message: 'Crop export requires a VLM-capable provider.'
    });
    const finalPath = output_path
      ? path.resolve(output_path)
      : defaultCropOutputPath(image_path, result.composition_style, result.selected_crop_mode);

    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    await fs.writeFile(finalPath, result.cropped_buffer);

    return {
      status: 'success',
      analysis_provider: result.analysis_provider,
      composition_style: result.composition_style,
      composition_observation: result.composition_observation,
      selected_crop_mode: result.selected_crop_mode,
      crop_plan: result.crop_plan,
      recommended_fujifilm_styles: result.recommended_fujifilm_styles,
      export_path: finalPath,
      source_file_deletion: 'disabled'
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

async function compose_fujifilm({
  image_path,
  composition_style = 'alex-webb',
  crop_mode = 'balanced',
  selected_style = null,
  output_path = null
} = {}) {
  let tmpDir = null;

  try {
    const config = readConfig();
    if (config.vlmProvider === 'disabled') {
      throw new FujiDayError('VLM_REQUIRED_FOR_CROP_EXPORT', 'Composition-to-Fujifilm export requires a VLM-capable provider.');
    }

    const composition = await buildCropRecommendation({ image_path, composition_style, crop_mode });

    if (!selected_style) {
      return {
        status: 'selection_required',
        analysis_provider: composition.analysis_provider,
        composition_style: composition.composition_style,
        composition_observation: composition.composition_observation,
        selected_crop_mode: composition.selected_crop_mode,
        crop_plan: composition.crop_plan,
        recommended_fujifilm_styles: composition.recommended_fujifilm_styles,
        prompt: 'Choose one Fujifilm style by name before exporting the final composed render.'
      };
    }

    const normalizedFujifilmStyle = colorRuntime.__private.normalizeSelectedStyle(selected_style);
    if (!normalizedFujifilmStyle) {
      throw new FujiDayError('INPUT_ERROR', 'selected_style must be a supported Fujifilm style.');
    }

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-compose-'));
    const tempCropPath = path.join(tmpDir, 'crop.jpg');
    await fs.writeFile(tempCropPath, composition.cropped_buffer);

    const finalOutputPath = output_path
      ? path.resolve(output_path)
      : defaultComposeOutputPath(image_path, composition.composition_style, composition.selected_crop_mode, normalizedFujifilmStyle);

    const grading = await colorRuntime.export_render({
      image_path: tempCropPath,
      selected_style: normalizedFujifilmStyle,
      image_observation: composition.fujifilm_image_observation,
      output_path: finalOutputPath
    });

    if (grading.status !== 'success') {
      return grading;
    }

    return {
      status: 'success',
      analysis_provider: composition.analysis_provider,
      composition: {
        composition_style: composition.composition_style,
        composition_observation: composition.composition_observation,
        selected_crop_mode: composition.selected_crop_mode,
        crop_plan: composition.crop_plan,
        recommended_fujifilm_styles: composition.recommended_fujifilm_styles
      },
      grading,
      final_export_path: grading.export_path
    };
  } catch (error) {
    return toErrorResult(error);
  } finally {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

module.exports = {
  name: 'fujiday_photo_composition_runtime',
  description: 'Analyze Alex Webb-like composition, recommend crops, export cropped images, and chain crop results into Fujifilm renders.',
  analyze_composition,
  list_crop_modes,
  recommend_crop,
  export_crop,
  compose_fujifilm
};
