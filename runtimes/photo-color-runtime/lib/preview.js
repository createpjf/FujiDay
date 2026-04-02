const sharp = require('sharp');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createNoiseOverlay(width, height, strength, seed) {
  const channels = 4;
  const buffer = Buffer.alloc(width * height * channels);
  let state = seed || 123456789;
  const amplitude = Math.max(4, Math.round(255 * strength));
  const alpha = clamp(Math.round(90 * strength), 12, 80);

  for (let index = 0; index < width * height; index += 1) {
    state = (1103515245 * state + 12345) & 0x7fffffff;
    const noise = 128 + Math.round(((state / 0x7fffffff) - 0.5) * amplitude);
    const offset = index * channels;
    buffer[offset] = clamp(noise, 0, 255);
    buffer[offset + 1] = clamp(noise, 0, 255);
    buffer[offset + 2] = clamp(noise, 0, 255);
    buffer[offset + 3] = alpha;
  }

  return sharp(buffer, { raw: { width, height, channels } }).png().toBuffer();
}

async function renderApproximationBuffer(buffer, previewPreset, observation, format = 'jpg') {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width;
  const height = metadata.height;

  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Preview generation requires valid image dimensions.');
  }

  let pipeline = sharp(buffer).rotate();

  if (previewPreset.monochrome) {
    pipeline = pipeline.grayscale();
  } else if (previewPreset.matrix) {
    pipeline = pipeline.recomb(previewPreset.matrix);
  }

  let saturation = previewPreset.saturation;
  let brightness = previewPreset.brightness;
  let contrast = previewPreset.contrast;

  if (observation.portrait_priority) {
    contrast = clamp(contrast - 0.03, 0.85, 1.2);
    brightness = clamp(brightness + 0.01, 0.9, 1.1);
  }
  if (observation.high_contrast_scene) {
    contrast = clamp(contrast - 0.04, 0.85, 1.2);
    brightness = clamp(brightness + 0.02, 0.9, 1.12);
  }
  if (observation.night_scene) {
    brightness = clamp(brightness + 0.03, 0.9, 1.15);
  }

  pipeline = pipeline
    .modulate({ saturation, brightness })
    .linear(contrast, Math.round(-(contrast - 1) * 64));

  const overlay = await createNoiseOverlay(width, height, previewPreset.grain, width * 131 + height * 17);

  if (format === 'png') {
    return pipeline.composite([{ input: overlay, blend: 'overlay' }]).png().toBuffer();
  }

  return pipeline.composite([{ input: overlay, blend: 'overlay' }]).jpeg({ quality: 90 }).toBuffer();
}

async function generatePreviewDataUri(buffer, previewPreset, observation) {
  const output = await renderApproximationBuffer(buffer, previewPreset, observation, 'jpg');
  return `data:image/jpeg;base64,${output.toString('base64')}`;
}

module.exports = {
  renderApproximationBuffer,
  generatePreviewDataUri
};
