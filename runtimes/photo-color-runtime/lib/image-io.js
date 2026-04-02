const fs = require('node:fs').promises;
const path = require('node:path');
const sharp = require('sharp');
const { FujiDayError } = require('./errors');

async function readAndValidateImage(imagePath, maxImageBytes) {
  if (typeof imagePath !== 'string' || imagePath.trim().length === 0) {
    throw new FujiDayError('INPUT_ERROR', 'image_path must be a non-empty string.');
  }
  if (!path.isAbsolute(imagePath)) {
    throw new FujiDayError('INPUT_ERROR', 'image_path must be an absolute path.');
  }

  const fileStat = await fs.stat(imagePath).catch(() => null);
  if (!fileStat || !fileStat.isFile()) {
    throw new FujiDayError('INPUT_ERROR', 'image_path must point to an existing file.');
  }
  if (!Number.isFinite(fileStat.size) || fileStat.size <= 0) {
    throw new FujiDayError('INPUT_ERROR', 'Input image file is empty or invalid.');
  }
  if (fileStat.size > maxImageBytes) {
    throw new FujiDayError(
      'INPUT_TOO_LARGE',
      `Input image exceeds max size ${maxImageBytes} bytes.`,
      { maxBytes: maxImageBytes, actualBytes: fileStat.size }
    );
  }

  const buffer = await fs.readFile(imagePath);

  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch (error) {
    throw new FujiDayError('IMAGE_METADATA_ERROR', `Unable to read image metadata: ${error.message}`);
  }

  if (!Number.isInteger(metadata.width) || !Number.isInteger(metadata.height) || metadata.width <= 0 || metadata.height <= 0) {
    throw new FujiDayError('IMAGE_METADATA_ERROR', 'Image metadata does not include valid width/height.');
  }

  return { buffer, metadata };
}

async function handleDeletion(imagePath, deleteAfter) {
  if (!deleteAfter) {
    return {
      source_file_deletion: 'disabled',
      source_file_deletion_message: null
    };
  }

  try {
    await fs.unlink(imagePath);
    return {
      source_file_deletion: 'deleted',
      source_file_deletion_message: null
    };
  } catch (error) {
    return {
      source_file_deletion: 'delete_failed',
      source_file_deletion_message: error.message
    };
  }
}

function slugifyStyle(styleName) {
  return styleName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function normalizeFormat(format, outputPath) {
  const ext = outputPath ? path.extname(outputPath).toLowerCase() : '';
  const requested = typeof format === 'string' && format ? format.toLowerCase() : '';
  const byExtension = ext === '.png' ? 'png' : ext === '.jpg' || ext === '.jpeg' ? 'jpg' : '';
  const finalFormat = requested || byExtension || 'jpg';

  if (!['jpg', 'jpeg', 'png'].includes(finalFormat)) {
    throw new FujiDayError('INPUT_ERROR', 'format must be jpg, jpeg, or png.');
  }

  return finalFormat === 'jpeg' ? 'jpg' : finalFormat;
}

function defaultOutputPath(imagePath, selectedStyle, format) {
  const ext = format === 'png' ? 'png' : 'jpg';
  const dir = path.dirname(imagePath);
  const base = path.basename(imagePath, path.extname(imagePath));
  return path.join(dir, `${base}.${slugifyStyle(selectedStyle)}.${ext}`);
}

async function writeOutputImage({ imagePath, outputPath, format, selectedStyle, buffer }) {
  const finalPath = outputPath ? path.resolve(outputPath) : defaultOutputPath(imagePath, selectedStyle, format);
  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  await fs.writeFile(finalPath, buffer);
  return finalPath;
}

module.exports = {
  readAndValidateImage,
  handleDeletion,
  normalizeFormat,
  writeOutputImage
};
