function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid env ${name}="${raw}": must be a non-negative number.`);
  }
  return Math.floor(parsed);
}

function envBool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`Invalid env ${name}="${raw}": must be "true" or "false".`);
}

function envString(name, fallback = '') {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return String(raw).trim();
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function normalizeOpenAIBaseUrl(baseUrl) {
  const normalized = stripTrailingSlash(baseUrl);
  return normalized.endsWith('/v1') ? normalized : `${normalized}/v1`;
}

function normalizeOllamaBaseUrl(baseUrl) {
  return stripTrailingSlash(baseUrl).replace(/\/v1$/, '');
}

function resolveProvider() {
  const explicit = envString('FUJIDAY_VLM_PROVIDER', '');
  if (explicit) {
    const normalized = explicit.toLowerCase();
    if (['openai', 'openai_compatible', 'ollama', 'disabled'].includes(normalized)) {
      return normalized;
    }
    throw new Error(`Invalid env FUJIDAY_VLM_PROVIDER="${explicit}": must be openai, openai_compatible, ollama, or disabled.`);
  }

  if (envString('OPENAI_API_KEY', '') || envString('FUJIDAY_VLM_API_KEY', '')) {
    return 'openai';
  }
  if (envString('OLLAMA_HOST', '')) {
    return 'ollama';
  }
  if (envString('FUJIDAY_VLM_BASE_URL', '')) {
    return 'openai_compatible';
  }
  return 'disabled';
}

function resolveModel(provider) {
  const explicitModel = envString('FUJIDAY_VLM_MODEL', '');
  if (explicitModel) return explicitModel;

  switch (provider) {
    case 'ollama':
      return 'llava';
    case 'disabled':
      return 'heuristic-local';
    case 'openai_compatible':
    case 'openai':
    default:
      return 'gpt-4o';
  }
}

function resolveBaseUrl(provider) {
  const explicitBaseUrl = envString('FUJIDAY_VLM_BASE_URL', '');
  const ollamaHost = envString('OLLAMA_HOST', '');

  switch (provider) {
    case 'openai':
      return normalizeOpenAIBaseUrl(explicitBaseUrl || 'https://api.openai.com');
    case 'openai_compatible':
      return explicitBaseUrl ? normalizeOpenAIBaseUrl(explicitBaseUrl) : '';
    case 'ollama':
      return normalizeOllamaBaseUrl(explicitBaseUrl || ollamaHost || 'http://127.0.0.1:11434');
    case 'disabled':
    default:
      return '';
  }
}

function readConfig() {
  const vlmProvider = resolveProvider();
  return {
    maxImageBytes: envInt('FUJIDAY_MAX_IMAGE_BYTES', 30 * 1024 * 1024),
    defaultOutputPreview: envBool('FUJIDAY_DEFAULT_OUTPUT_PREVIEW', false),
    vlmTimeoutMs: envInt('FUJIDAY_VLM_TIMEOUT_MS', 15000),
    vlmMaxRetries: envInt('FUJIDAY_VLM_MAX_RETRIES', 2),
    vlmProvider,
    vlmBaseUrl: resolveBaseUrl(vlmProvider),
    vlmApiKey: envString('FUJIDAY_VLM_API_KEY', '') || envString('OPENAI_API_KEY', ''),
    vlmModel: resolveModel(vlmProvider)
  };
}

module.exports = {
  readConfig
};
