const { FujiDayError } = require('./errors');
const sharp = require('sharp');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeEnum(value, allowed, fallback = null) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function parseObservationPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new FujiDayError('VLM_SCHEMA_ERROR', 'VLM response is not a valid JSON object.');
  }

  const contrastRisk = normalizeEnum(raw.contrast_risk, ['low', 'medium', 'high']);
  const skinToneImportance = normalizeEnum(raw.skin_tone_importance, ['low', 'medium', 'high']);
  const monochromeSuitability = normalizeEnum(raw.monochrome_suitability, ['plausible', 'not_recommended']);

  if (!contrastRisk || !skinToneImportance || !monochromeSuitability) {
    throw new FujiDayError('VLM_SCHEMA_ERROR', 'VLM response contains invalid enum values.');
  }

  if (typeof raw.subject !== 'string' || typeof raw.lighting !== 'string') {
    throw new FujiDayError('VLM_SCHEMA_ERROR', 'VLM response missing subject or lighting strings.');
  }

  if (
    typeof raw.portrait_priority !== 'boolean' ||
    typeof raw.high_contrast_scene !== 'boolean' ||
    typeof raw.night_scene !== 'boolean'
  ) {
    throw new FujiDayError('VLM_SCHEMA_ERROR', 'VLM response missing boolean scene flags.');
  }

  return {
    subject: raw.subject.trim(),
    lighting: raw.lighting.trim(),
    contrast_risk: contrastRisk,
    skin_tone_importance: skinToneImportance,
    monochrome_suitability: monochromeSuitability,
    portrait_priority: raw.portrait_priority,
    high_contrast_scene: raw.high_contrast_scene,
    night_scene: raw.night_scene,
    summary: typeof raw.summary === 'string' ? raw.summary.trim() : ''
  };
}

function withObservationMeta(observation, { provider, mode, note = null }) {
  return {
    ...observation,
    analysis_provider: provider,
    analysis_mode: mode,
    analysis_note: note
  };
}

function buildPrompt(width, height) {
  return [
    'Analyze the uploaded photo for Fujifilm Film Simulation planning.',
    `Image size: ${width}x${height}.`,
    'Return JSON only with these fields:',
    '{',
    '  "subject": string,',
    '  "lighting": string,',
    '  "contrast_risk": "low" | "medium" | "high",',
    '  "skin_tone_importance": "low" | "medium" | "high",',
    '  "monochrome_suitability": "plausible" | "not_recommended",',
    '  "portrait_priority": boolean,',
    '  "high_contrast_scene": boolean,',
    '  "night_scene": boolean,',
    '  "summary": string',
    '}',
    'Use concise, photography-aware descriptions.'
  ].join('\n');
}

function parseJsonOrThrow(raw, errorCode, errorMessage) {
  try {
    return JSON.parse(raw);
  } catch {
    throw new FujiDayError(errorCode, errorMessage);
  }
}

async function buildHeuristicObservation({ imageBuffer, width, height, note = null }) {
  const stats = await sharp(imageBuffer).stats();
  const rgbChannels = stats.channels.slice(0, 3);
  const means = rgbChannels.map(channel => channel.mean);
  const stdevs = rgbChannels.map(channel => channel.stdev);
  const brightness = means.reduce((sum, value) => sum + value, 0) / means.length;
  const contrast = stdevs.reduce((sum, value) => sum + value, 0) / stdevs.length;
  const colorSpread = Math.max(...means) - Math.min(...means);
  const isVertical = height > width * 1.15;
  const isBright = brightness > 165;
  const isDark = brightness < 85;
  const highContrastScene = contrast >= 52 || (isBright && contrast >= 38);
  const portraitPriority = isVertical && !highContrastScene && brightness > 95 && colorSpread < 42;
  const skinToneImportance = portraitPriority ? 'medium' : 'low';
  const monochromeSuitability = contrast >= 40 || colorSpread <= 18 ? 'plausible' : 'not_recommended';
  const lighting = isDark
    ? 'dim or night-like light'
    : highContrastScene
      ? 'bright scene with strong contrast'
      : 'soft or even light';

  return withObservationMeta({
    subject: portraitPriority ? 'possible portrait-oriented scene' : isVertical ? 'vertical general scene' : 'general scene',
    lighting,
    contrast_risk: highContrastScene ? 'high' : contrast >= 28 ? 'medium' : 'low',
    skin_tone_importance: skinToneImportance,
    monochrome_suitability: monochromeSuitability,
    portrait_priority: portraitPriority,
    high_contrast_scene: highContrastScene,
    night_scene: isDark,
    summary: `Local heuristic analysis estimated brightness ${Math.round(brightness)}, contrast ${Math.round(contrast)}, and color spread ${Math.round(colorSpread)}.`
  }, {
    provider: 'disabled',
    mode: 'heuristic',
    note
  });
}

async function requestOpenAICompatible({
  imageBase64,
  width,
  height,
  model,
  timeoutMs,
  maxRetries,
  provider,
  baseUrl,
  apiKey
}) {
  if (provider === 'openai' && !apiKey) {
    throw new FujiDayError('CONFIG_ERROR', 'OPENAI_API_KEY or FUJIDAY_VLM_API_KEY is required for the openai provider.');
  }
  if (!baseUrl) {
    throw new FujiDayError('CONFIG_ERROR', `FUJIDAY_VLM_BASE_URL is required for the ${provider} provider.`);
  }

  const prompt = buildPrompt(width, height);

  const retryableCodes = new Set(['VLM_TIMEOUT', 'VLM_NETWORK_ERROR', 'VLM_HTTP_TRANSIENT']);
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
              ]
            }
          ]
        }),
        signal: controller.signal
      });

      const responseText = await response.text();
      if (!response.ok) {
        const code = response.status >= 500 || response.status === 429 ? 'VLM_HTTP_TRANSIENT' : 'VLM_HTTP_ERROR';
        throw new FujiDayError(
          code,
          `VLM request failed with status ${response.status}.`,
          { status: response.status, body: responseText.slice(0, 512) }
        );
      }

      let payload;
      payload = parseJsonOrThrow(responseText, 'VLM_PARSE_ERROR', 'Unable to parse VLM HTTP response as JSON.');

      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new FujiDayError('VLM_SCHEMA_ERROR', 'VLM response missing choices[0].message.content string.');
      }

      const rawObservation = parseJsonOrThrow(content, 'VLM_PARSE_ERROR', 'Unable to parse VLM observation JSON payload.');
      return withObservationMeta(parseObservationPayload(rawObservation), {
        provider,
        mode: 'vlm'
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        lastError = new FujiDayError('VLM_TIMEOUT', `VLM request timed out after ${timeoutMs}ms.`);
      } else if (error instanceof FujiDayError) {
        lastError = error;
      } else {
        lastError = new FujiDayError('VLM_NETWORK_ERROR', error.message);
      }

      if (!retryableCodes.has(lastError.code) || attempt === maxRetries) break;
      await sleep(200 * Math.pow(2, attempt));
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  throw lastError;
}

async function requestOllama({
  imageBase64,
  width,
  height,
  model,
  timeoutMs,
  maxRetries,
  baseUrl
}) {
  if (!baseUrl) {
    throw new FujiDayError('CONFIG_ERROR', 'OLLAMA_HOST or FUJIDAY_VLM_BASE_URL is required for the ollama provider.');
  }

  const prompt = buildPrompt(width, height);
  const retryableCodes = new Set(['VLM_TIMEOUT', 'VLM_NETWORK_ERROR', 'VLM_HTTP_TRANSIENT']);
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          stream: false,
          format: 'json',
          messages: [
            {
              role: 'user',
              content: prompt,
              images: [imageBase64]
            }
          ]
        }),
        signal: controller.signal
      });

      const responseText = await response.text();
      if (!response.ok) {
        const code = response.status >= 500 || response.status === 429 ? 'VLM_HTTP_TRANSIENT' : 'VLM_HTTP_ERROR';
        throw new FujiDayError(
          code,
          `Ollama request failed with status ${response.status}.`,
          { status: response.status, body: responseText.slice(0, 512) }
        );
      }

      const payload = parseJsonOrThrow(responseText, 'VLM_PARSE_ERROR', 'Unable to parse Ollama HTTP response as JSON.');
      const content = payload?.message?.content;
      if (typeof content !== 'string') {
        throw new FujiDayError('VLM_SCHEMA_ERROR', 'Ollama response missing message.content string.');
      }

      const rawObservation = parseJsonOrThrow(content, 'VLM_PARSE_ERROR', 'Unable to parse Ollama observation JSON payload.');
      return withObservationMeta(parseObservationPayload(rawObservation), {
        provider: 'ollama',
        mode: 'vlm'
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        lastError = new FujiDayError('VLM_TIMEOUT', `VLM request timed out after ${timeoutMs}ms.`);
      } else if (error instanceof FujiDayError) {
        lastError = error;
      } else {
        lastError = new FujiDayError('VLM_NETWORK_ERROR', error.message);
      }

      if (!retryableCodes.has(lastError.code) || attempt === maxRetries) break;
      await sleep(200 * Math.pow(2, attempt));
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  throw lastError;
}

async function analyzeImageObservation({
  imageBuffer,
  width,
  height,
  provider,
  baseUrl,
  model,
  timeoutMs,
  maxRetries,
  apiKey
}) {
  if (!imageBuffer) {
    throw new FujiDayError('INPUT_ERROR', 'imageBuffer is required for image observation.');
  }

  if (provider === 'disabled') {
    return buildHeuristicObservation({
      imageBuffer,
      width,
      height,
      note: 'Local heuristic mode was selected explicitly.'
    });
  }

  const imageBase64 = imageBuffer.toString('base64');

  try {
    if (provider === 'ollama') {
      return await requestOllama({
        imageBase64,
        width,
        height,
        model,
        timeoutMs,
        maxRetries,
        baseUrl
      });
    }

    return await requestOpenAICompatible({
      imageBase64,
      width,
      height,
      model,
      timeoutMs,
      maxRetries,
      provider,
      baseUrl,
      apiKey
    });
  } catch (error) {
    if (error instanceof FujiDayError && error.code === 'CONFIG_ERROR') {
      return buildHeuristicObservation({
        imageBuffer,
        width,
        height,
        note: `Heuristic fallback was used because the ${provider} provider is not fully configured: ${error.message}`
      });
    }
    throw error;
  }
}

module.exports = {
  analyzeImageObservation
};
