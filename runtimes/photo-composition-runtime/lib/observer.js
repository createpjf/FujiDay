const sharp = require('sharp');
const { FujiDayError } = require('../../photo-color-runtime/lib/errors');
const { requestMiniMaxImageUnderstanding } = require('../../photo-color-runtime/lib/minimax-mcp');

const LEVELS = ['low', 'medium', 'high'];
const FIT_LEVELS = ['low', 'medium', 'high'];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeEnum(value, allowed) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : null;
}

function isNormalizedCoordList(value) {
  return Array.isArray(value) &&
    value.length === 4 &&
    value.every(item => typeof item === 'number' && Number.isFinite(item) && item >= 0 && item <= 1) &&
    value[2] > value[0] &&
    value[3] > value[1];
}

function parseSecondaryCrop(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new FujiDayError('VLM_SCHEMA_ERROR', 'Secondary crop entry must be an object.');
  }
  if (!isNormalizedCoordList(raw.coords_norm)) {
    throw new FujiDayError('VLM_SCHEMA_ERROR', 'Secondary crop entry must include valid coords_norm.');
  }
  if (typeof raw.aspect_ratio !== 'string' || typeof raw.rationale !== 'string') {
    throw new FujiDayError('VLM_SCHEMA_ERROR', 'Secondary crop entry missing aspect_ratio or rationale.');
  }

  return {
    coords_norm: raw.coords_norm,
    aspect_ratio: raw.aspect_ratio.trim(),
    rationale: raw.rationale.trim()
  };
}

function parseCropCandidate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new FujiDayError('VLM_SCHEMA_ERROR', 'Crop candidate must be an object.');
  }
  if (!isNormalizedCoordList(raw.coords_norm)) {
    throw new FujiDayError('VLM_SCHEMA_ERROR', 'Crop candidate must include valid coords_norm.');
  }
  if (typeof raw.aspect_ratio !== 'string' || typeof raw.rationale !== 'string') {
    throw new FujiDayError('VLM_SCHEMA_ERROR', 'Crop candidate missing aspect_ratio or rationale.');
  }
  const secondary = raw.secondary_crops === undefined ? [] : raw.secondary_crops;
  if (!Array.isArray(secondary)) {
    throw new FujiDayError('VLM_SCHEMA_ERROR', 'Crop candidate secondary_crops must be an array.');
  }

  return {
    coords_norm: raw.coords_norm,
    aspect_ratio: raw.aspect_ratio.trim(),
    rationale: raw.rationale.trim(),
    secondary_crops: secondary.map(parseSecondaryCrop)
  };
}

function parseObservationPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new FujiDayError('VLM_SCHEMA_ERROR', 'VLM response is not a valid JSON object.');
  }

  const parsed = {
    summary: typeof raw.summary === 'string' ? raw.summary.trim() : '',
    foreground_strength: normalizeEnum(raw.foreground_strength, LEVELS),
    midground_strength: normalizeEnum(raw.midground_strength, LEVELS),
    background_strength: normalizeEnum(raw.background_strength, LEVELS),
    subject_separation: normalizeEnum(raw.subject_separation, LEVELS),
    color_tension: normalizeEnum(raw.color_tension, LEVELS),
    light_tension: normalizeEnum(raw.light_tension, LEVELS),
    narrative_density: normalizeEnum(raw.narrative_density, LEVELS),
    edge_pressure: normalizeEnum(raw.edge_pressure, LEVELS),
    webb_fit: normalizeEnum(raw.webb_fit, FIT_LEVELS)
  };

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'summary') continue;
    if (!value) {
      throw new FujiDayError('VLM_SCHEMA_ERROR', `VLM response contains invalid value for ${key}.`);
    }
  }

  if (!raw.crop_candidates || typeof raw.crop_candidates !== 'object' || Array.isArray(raw.crop_candidates)) {
    throw new FujiDayError('VLM_SCHEMA_ERROR', 'VLM response missing crop_candidates object.');
  }

  return {
    ...parsed,
    crop_candidates: {
      balanced: parseCropCandidate(raw.crop_candidates.balanced),
      narrative: parseCropCandidate(raw.crop_candidates.narrative),
      webb_risky: parseCropCandidate(raw.crop_candidates.webb_risky)
    }
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
    'Analyze the uploaded photo for Alex Webb-like composition and cropping.',
    `Image size: ${width}x${height}.`,
    'Return JSON only with these fields:',
    '{',
    '  "summary": string,',
    '  "foreground_strength": "low" | "medium" | "high",',
    '  "midground_strength": "low" | "medium" | "high",',
    '  "background_strength": "low" | "medium" | "high",',
    '  "subject_separation": "low" | "medium" | "high",',
    '  "color_tension": "low" | "medium" | "high",',
    '  "light_tension": "low" | "medium" | "high",',
    '  "narrative_density": "low" | "medium" | "high",',
    '  "edge_pressure": "low" | "medium" | "high",',
    '  "webb_fit": "low" | "medium" | "high",',
    '  "crop_candidates": {',
    '    "balanced": {',
    '      "coords_norm": [x0, y0, x1, y1],',
    '      "aspect_ratio": string,',
    '      "rationale": string,',
    '      "secondary_crops": [{"coords_norm":[x0,y0,x1,y1],"aspect_ratio":string,"rationale":string}]',
    '    },',
    '    "narrative": {',
    '      "coords_norm": [x0, y0, x1, y1],',
    '      "aspect_ratio": string,',
    '      "rationale": string,',
    '      "secondary_crops": [{"coords_norm":[x0,y0,x1,y1],"aspect_ratio":string,"rationale":string}]',
    '    },',
    '    "webb_risky": {',
    '      "coords_norm": [x0, y0, x1, y1],',
    '      "aspect_ratio": string,',
    '      "rationale": string,',
    '      "secondary_crops": [{"coords_norm":[x0,y0,x1,y1],"aspect_ratio":string,"rationale":string}]',
    '    }',
    '  }',
    '}',
    'Use concise photography-aware language. Coordinates must be normalized 0-1 values within the image.'
  ].join('\n');
}

function parseJsonOrThrow(raw, errorCode, errorMessage) {
  try {
    return JSON.parse(raw);
  } catch {
    if (typeof raw === 'string') {
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const candidate = fenced?.[1]?.trim() || raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1).trim();

      if (candidate) {
        try {
          return JSON.parse(candidate);
        } catch {
          // Fall through to the structured error below.
        }
      }
    }

    throw new FujiDayError(errorCode, errorMessage, typeof raw === 'string' ? { raw: raw.slice(0, 512) } : null);
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
  const isLandscape = width >= height;
  const foreground = isLandscape ? 'medium' : 'low';
  const midground = 'medium';
  const background = isLandscape ? 'medium' : 'low';
  const colorTension = colorSpread >= 34 ? 'medium' : 'low';
  const lightTension = contrast >= 42 ? 'medium' : 'low';
  const narrativeDensity = isLandscape ? 'medium' : 'low';
  const edgePressure = isLandscape && contrast >= 30 ? 'medium' : 'low';
  const webbFit = contrast >= 42 && colorSpread >= 34 && isLandscape ? 'medium' : 'low';

  return withObservationMeta({
    summary: `Local heuristic composition pass estimated brightness ${Math.round(brightness)}, contrast ${Math.round(contrast)}, and color spread ${Math.round(colorSpread)}.`,
    foreground_strength: foreground,
    midground_strength: midground,
    background_strength: background,
    subject_separation: contrast >= 38 ? 'medium' : 'low',
    color_tension: colorTension,
    light_tension: lightTension,
    narrative_density: narrativeDensity,
    edge_pressure: edgePressure,
    webb_fit: webbFit,
    crop_candidates: null
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
      const headers = { 'Content-Type': 'application/json' };
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
        throw new FujiDayError(code, `VLM request failed with status ${response.status}.`, {
          status: response.status,
          body: responseText.slice(0, 512)
        });
      }

      const payload = parseJsonOrThrow(responseText, 'VLM_PARSE_ERROR', 'Unable to parse composition VLM response as JSON.');
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new FujiDayError('VLM_SCHEMA_ERROR', 'Composition VLM response missing choices[0].message.content string.');
      }

      const rawObservation = parseJsonOrThrow(content, 'VLM_PARSE_ERROR', 'Unable to parse composition observation JSON payload.');
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
        headers: { 'Content-Type': 'application/json' },
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
        throw new FujiDayError(code, `Ollama request failed with status ${response.status}.`, {
          status: response.status,
          body: responseText.slice(0, 512)
        });
      }

      const payload = parseJsonOrThrow(responseText, 'VLM_PARSE_ERROR', 'Unable to parse Ollama composition response as JSON.');
      const content = payload?.message?.content;
      if (typeof content !== 'string') {
        throw new FujiDayError('VLM_SCHEMA_ERROR', 'Ollama composition response missing message.content string.');
      }

      const rawObservation = parseJsonOrThrow(content, 'VLM_PARSE_ERROR', 'Unable to parse Ollama composition observation JSON payload.');
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

async function requestMiniMax({
  imagePath,
  width,
  height,
  timeoutMs,
  provider,
  baseUrl,
  apiKey,
  minimaxMcpCommand,
  minimaxMcpArgs,
  minimaxMcpBasePath,
  minimaxApiResourceMode
}) {
  const prompt = buildPrompt(width, height);
  const rawText = await requestMiniMaxImageUnderstanding({
    imagePath,
    prompt,
    timeoutMs,
    apiKey,
    apiHost: baseUrl,
    mcpCommand: minimaxMcpCommand,
    mcpArgs: minimaxMcpArgs,
    mcpBasePath: minimaxMcpBasePath,
    apiResourceMode: minimaxApiResourceMode
  });

  const rawObservation = parseJsonOrThrow(
    rawText,
    'VLM_PARSE_ERROR',
    'Unable to parse MiniMax composition observation JSON payload.'
  );

  return withObservationMeta(parseObservationPayload(rawObservation), {
    provider,
    mode: 'vlm'
  });
}

async function analyzeCompositionObservation({
  imageBuffer,
  imagePath,
  width,
  height,
  provider,
  baseUrl,
  model,
  timeoutMs,
  maxRetries,
  apiKey,
  minimaxMcpCommand,
  minimaxMcpArgs,
  minimaxMcpBasePath,
  minimaxApiResourceMode
}) {
  if (!imageBuffer) {
    throw new FujiDayError('INPUT_ERROR', 'imageBuffer is required for composition analysis.');
  }

  if (provider === 'disabled') {
    return buildHeuristicObservation({
      imageBuffer,
      width,
      height,
      note: 'Crop export and composition-to-Fujifilm chaining require a VLM-capable provider.'
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

    if (provider === 'minimax') {
      return await requestMiniMax({
        imagePath,
        width,
        height,
        timeoutMs,
        provider,
        baseUrl,
        apiKey,
        minimaxMcpCommand,
        minimaxMcpArgs,
        minimaxMcpBasePath,
        minimaxApiResourceMode
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
  analyzeCompositionObservation,
  __private: {
    buildHeuristicObservation,
    parseObservationPayload
  }
};
