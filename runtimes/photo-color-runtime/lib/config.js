const os = require('node:os');

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

function envStringArray(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;

  const trimmed = String(raw).trim();
  if (!trimmed) return fallback;

  if (trimmed.startsWith('[')) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error(`Invalid env ${name}: JSON array could not be parsed.`);
    }

    if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string' || !item.trim())) {
      throw new Error(`Invalid env ${name}: must be a JSON array of non-empty strings.`);
    }

    return parsed.map(item => item.trim());
  }

  return trimmed.split(/\s+/).filter(Boolean);
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

function normalizeMiniMaxHost(baseUrl) {
  return stripTrailingSlash(baseUrl);
}

function resolveProvider() {
  const explicit = envString('FUJIDAY_VLM_PROVIDER', '');
  if (explicit) {
    const normalized = explicit.toLowerCase();
    if (['openai', 'openai_compatible', 'ollama', 'minimax', 'disabled'].includes(normalized)) {
      return normalized;
    }
    throw new Error(`Invalid env FUJIDAY_VLM_PROVIDER="${explicit}": must be openai, openai_compatible, ollama, minimax, or disabled.`);
  }

  if (envString('OPENAI_API_KEY', '')) {
    return 'openai';
  }
  if (envString('OLLAMA_HOST', '')) {
    return 'ollama';
  }
  if (envString('FUJIDAY_VLM_BASE_URL', '')) {
    return 'openai_compatible';
  }
  if (envString('FUJIDAY_VLM_API_KEY', '')) {
    return 'openai';
  }
  if (envString('MINIMAX_API_KEY', '') || envString('FUJIDAY_MINIMAX_API_KEY', '')) {
    return 'minimax';
  }
  return 'disabled';
}

function resolveModel(provider) {
  const explicitModel = envString('FUJIDAY_VLM_MODEL', '');
  if (explicitModel) return explicitModel;

  switch (provider) {
    case 'ollama':
      return 'llava';
    case 'minimax':
      return 'minimax-understand_image';
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
    case 'minimax':
      return normalizeMiniMaxHost(explicitBaseUrl || envString('MINIMAX_API_HOST', 'https://api.minimax.io'));
    case 'disabled':
    default:
      return '';
  }
}

function resolveApiKey(provider) {
  switch (provider) {
    case 'minimax':
      return envString('MINIMAX_API_KEY', '') ||
        envString('FUJIDAY_MINIMAX_API_KEY', '') ||
        envString('FUJIDAY_VLM_API_KEY', '');
    case 'openai':
    case 'openai_compatible':
      return envString('FUJIDAY_VLM_API_KEY', '') || envString('OPENAI_API_KEY', '');
    case 'ollama':
    case 'disabled':
    default:
      return '';
  }
}

function resolveMiniMaxMcpArgs() {
  if (process.env.FUJIDAY_MINIMAX_MCP_ARGS !== undefined && process.env.FUJIDAY_MINIMAX_MCP_ARGS !== '') {
    return envStringArray('FUJIDAY_MINIMAX_MCP_ARGS', ['minimax-coding-plan-mcp', '-y']);
  }
  if (process.env.MINIMAX_MCP_ARGS !== undefined && process.env.MINIMAX_MCP_ARGS !== '') {
    return envStringArray('MINIMAX_MCP_ARGS', ['minimax-coding-plan-mcp', '-y']);
  }
  return ['minimax-coding-plan-mcp', '-y'];
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
    vlmApiKey: resolveApiKey(vlmProvider),
    vlmModel: resolveModel(vlmProvider),
    minimaxMcpCommand: envString('FUJIDAY_MINIMAX_MCP_COMMAND', envString('MINIMAX_MCP_COMMAND', 'uvx')),
    minimaxMcpArgs: resolveMiniMaxMcpArgs(),
    minimaxMcpBasePath: envString('MINIMAX_MCP_BASE_PATH', os.tmpdir()),
    minimaxApiResourceMode: envString('MINIMAX_API_RESOURCE_MODE', '')
  };
}

module.exports = {
  readConfig
};
