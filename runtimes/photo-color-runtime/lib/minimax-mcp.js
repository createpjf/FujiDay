const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');

const { FujiDayError } = require('./errors');

const DEFAULT_PROTOCOL_VERSION = '2024-11-05';
let activeSession = null;
let activeSessionFingerprint = null;
let exitHookRegistered = false;

function serializeMessage(message) {
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    ...message
  });

  return `Content-Length: ${Buffer.byteLength(payload, 'utf8')}\r\n\r\n${payload}`;
}

function createMessageParser(onMessage, onParseError) {
  let buffer = Buffer.alloc(0);

  return chunk => {
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);

    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;

      const headerText = buffer.slice(0, headerEnd).toString('utf8');
      const lengthMatch = /Content-Length:\s*(\d+)/i.exec(headerText);
      if (!lengthMatch) {
        onParseError(new FujiDayError('VLM_PARSE_ERROR', 'MiniMax MCP response missing Content-Length header.'));
        return;
      }

      const contentLength = Number(lengthMatch[1]);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + contentLength;

      if (buffer.length < bodyEnd) return;

      const bodyText = buffer.slice(bodyStart, bodyEnd).toString('utf8');
      buffer = buffer.slice(bodyEnd);

      try {
        onMessage(JSON.parse(bodyText));
      } catch {
        onParseError(new FujiDayError('VLM_PARSE_ERROR', 'Unable to parse MiniMax MCP JSON-RPC payload.'));
        return;
      }
    }
  };
}

function pickToolArgumentName(tool) {
  const properties = tool?.inputSchema?.properties || tool?.input_schema?.properties || {};
  if (properties.image_url) return 'image_url';
  if (properties.image_source) return 'image_source';
  return 'image_url';
}

function extractToolText(result) {
  const textParts = [];
  const content = Array.isArray(result?.content) ? result.content : [];

  for (const item of content) {
    if (item?.type === 'text' && typeof item.text === 'string' && item.text.trim()) {
      textParts.push(item.text.trim());
    }
  }

  if (textParts.length > 0) {
    return textParts.join('\n');
  }

  if (result?.structuredContent && typeof result.structuredContent === 'object') {
    return JSON.stringify(result.structuredContent);
  }

  if (typeof result?.content === 'string' && result.content.trim()) {
    return result.content.trim();
  }

  throw new FujiDayError('VLM_SCHEMA_ERROR', 'MiniMax understand_image returned no readable text content.');
}

function buildSessionFingerprint({ apiHost, apiKey, mcpCommand, mcpArgs, mcpBasePath, apiResourceMode }) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify({
    apiHost: apiHost || '',
    apiKey: apiKey || '',
    mcpCommand,
    mcpArgs,
    mcpBasePath,
    apiResourceMode: apiResourceMode || ''
  }));
  return hash.digest('hex');
}

function remainingMs(deadlineMs) {
  return Math.max(1, deadlineMs - Date.now());
}

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(new FujiDayError('VLM_TIMEOUT', message));
    }, timeoutMs);

    promise.then(
      value => {
        clearTimeout(timeoutHandle);
        resolve(value);
      },
      error => {
        clearTimeout(timeoutHandle);
        reject(error);
      }
    );
  });
}

class MiniMaxMcpSession {
  constructor({ apiHost, apiKey, mcpCommand, mcpArgs, mcpBasePath, apiResourceMode }) {
    this.closed = false;
    this.child = childProcess.spawn(mcpCommand, mcpArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MINIMAX_API_KEY: apiKey,
        MINIMAX_API_HOST: apiHost || 'https://api.minimax.io',
        MINIMAX_MCP_BASE_PATH: mcpBasePath || process.cwd(),
        ...(apiResourceMode ? { MINIMAX_API_RESOURCE_MODE: apiResourceMode } : {})
      }
    });
    this.nextId = 1;
    this.pending = new Map();
    this.stderrChunks = [];
    this.toolArgumentName = 'image_url';

    this.handleStdout = createMessageParser(
      message => this.onMessage(message),
      error => this.dispose(error)
    );
    this.handleStderr = chunk => {
      this.stderrChunks.push(Buffer.from(chunk).toString('utf8'));
    };
    this.handleSpawnError = error => {
      this.dispose(new FujiDayError(
        'CONFIG_ERROR',
        `Unable to start MiniMax MCP command "${mcpCommand}": ${error.message}`
      ));
    };
    this.handleExit = code => {
      if (this.closed) return;
      const stderrText = this.stderrChunks.join('').trim();
      this.dispose(new FujiDayError(
        'VLM_NETWORK_ERROR',
        `MiniMax MCP process exited before completing the request${code === null ? '' : ` (code ${code})`}.`,
        stderrText ? { stderr: stderrText.slice(0, 512) } : null
      ));
    };

    this.child.stdout.on('data', this.handleStdout);
    this.child.stderr.on('data', this.handleStderr);
    this.child.on('error', this.handleSpawnError);
    this.child.on('exit', this.handleExit);

    this.ready = this.initialize();
    this.ready.catch(error => {
      if (!this.closed) {
        this.dispose(error);
      }
    });
  }

  onMessage(message) {
    if (!Object.prototype.hasOwnProperty.call(message, 'id')) {
      return;
    }

    const pendingRequest = this.pending.get(message.id);
    if (!pendingRequest) return;
    this.pending.delete(message.id);

    if (message.error) {
      pendingRequest.reject(new FujiDayError(
        'VLM_NETWORK_ERROR',
        message.error.message || 'MiniMax MCP request failed.',
        message.error
      ));
      return;
    }

    pendingRequest.resolve(message.result);
  }

  request(method, params = {}) {
    if (this.closed) {
      return Promise.reject(new FujiDayError('VLM_NETWORK_ERROR', 'MiniMax MCP session is closed.'));
    }

    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(serializeMessage({ id, method, params }), error => {
        if (!error) return;
        this.pending.delete(id);
        reject(new FujiDayError('VLM_NETWORK_ERROR', `Failed to write MiniMax MCP request: ${error.message}`));
      });
    });
  }

  notify(method, params = {}) {
    if (this.closed) return;
    this.child.stdin.write(serializeMessage({ method, params }));
  }

  async initialize() {
    const initResult = await this.request('initialize', {
      protocolVersion: DEFAULT_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: 'fujiday',
        version: '0.1.0'
      }
    });

    if (!initResult) {
      throw new FujiDayError('VLM_SCHEMA_ERROR', 'MiniMax MCP initialize response was empty.');
    }

    this.notify('notifications/initialized');

    const toolsResult = await this.request('tools/list');
    const tools = Array.isArray(toolsResult?.tools) ? toolsResult.tools : [];
    const understandImageTool = tools.find(tool => tool?.name === 'understand_image');

    if (!understandImageTool) {
      throw new FujiDayError('CONFIG_ERROR', 'MiniMax MCP server does not expose the understand_image tool.');
    }

    this.toolArgumentName = pickToolArgumentName(understandImageTool);
  }

  async understandImage({ imagePath, prompt, timeoutMs }) {
    const absoluteImagePath = path.resolve(imagePath);
    const deadlineMs = Date.now() + timeoutMs;
    const timeoutMessage = `MiniMax MCP request timed out after ${timeoutMs}ms.`;

    await withTimeout(this.ready, remainingMs(deadlineMs), timeoutMessage);

    const toolResult = await withTimeout(this.request('tools/call', {
      name: 'understand_image',
      arguments: {
        prompt,
        [this.toolArgumentName]: absoluteImagePath
      }
    }), remainingMs(deadlineMs), timeoutMessage);

    if (toolResult?.isError) {
      throw new FujiDayError('VLM_HTTP_ERROR', 'MiniMax understand_image returned an error.', toolResult);
    }

    return extractToolText(toolResult);
  }

  dispose(reason = new FujiDayError('VLM_NETWORK_ERROR', 'MiniMax MCP session was closed.')) {
    if (this.closed) return;
    this.closed = true;

    this.child.stdout.off('data', this.handleStdout);
    this.child.stderr.off('data', this.handleStderr);
    this.child.off('error', this.handleSpawnError);
    this.child.off('exit', this.handleExit);

    for (const entry of this.pending.values()) {
      entry.reject(reason);
    }
    this.pending.clear();

    try {
      this.child.stdin.end();
    } catch {
      // Best-effort shutdown; the process may already be gone.
    }

    try {
      this.child.kill();
    } catch {
      // Best-effort shutdown; the process may already be gone.
    }
  }
}

function closeActiveMiniMaxSession() {
  if (!activeSession) return;
  const session = activeSession;
  activeSession = null;
  activeSessionFingerprint = null;
  session.dispose();
}

function getOrCreateSession(config) {
  if (!exitHookRegistered) {
    process.once('exit', () => closeActiveMiniMaxSession());
    exitHookRegistered = true;
  }

  const fingerprint = buildSessionFingerprint(config);
  if (activeSession && !activeSession.closed && activeSessionFingerprint === fingerprint) {
    return activeSession;
  }

  closeActiveMiniMaxSession();
  activeSessionFingerprint = fingerprint;
  activeSession = new MiniMaxMcpSession(config);
  return activeSession;
}

async function requestMiniMaxImageUnderstanding({
  imagePath,
  prompt,
  timeoutMs,
  apiKey,
  apiHost,
  mcpCommand,
  mcpArgs,
  mcpBasePath,
  apiResourceMode
}) {
  if (!apiKey) {
    throw new FujiDayError(
      'CONFIG_ERROR',
      'MINIMAX_API_KEY, FUJIDAY_MINIMAX_API_KEY, or FUJIDAY_VLM_API_KEY is required for the minimax provider.'
    );
  }
  if (!imagePath) {
    throw new FujiDayError('INPUT_ERROR', 'imagePath is required for the minimax provider.');
  }
  if (!mcpCommand) {
    throw new FujiDayError('CONFIG_ERROR', 'FUJIDAY_MINIMAX_MCP_COMMAND must not be empty for the minimax provider.');
  }
  if (!Array.isArray(mcpArgs) || mcpArgs.length === 0) {
    throw new FujiDayError('CONFIG_ERROR', 'FUJIDAY_MINIMAX_MCP_ARGS must provide the MiniMax MCP launch arguments.');
  }

  const session = getOrCreateSession({
    apiHost,
    apiKey,
    mcpCommand,
    mcpArgs,
    mcpBasePath,
    apiResourceMode
  });

  try {
    return await session.understandImage({
      imagePath,
      prompt,
      timeoutMs
    });
  } catch (error) {
    if (session === activeSession && error instanceof FujiDayError && ['VLM_TIMEOUT', 'VLM_NETWORK_ERROR', 'CONFIG_ERROR'].includes(error.code)) {
      closeActiveMiniMaxSession();
    }
    throw error;
  }
}

module.exports = {
  requestMiniMaxImageUnderstanding,
  __private: {
    closeActiveMiniMaxSession,
    MiniMaxMcpSession,
    buildSessionFingerprint,
    createMessageParser,
    extractToolText,
    pickToolArgumentName,
    serializeMessage
  }
};
