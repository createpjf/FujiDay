const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const childProcess = require('node:child_process');
const sharp = require('sharp');

const MODULE_PATH = '../runtimes/photo-color-runtime';
const { createMiniMaxMcpSpawnStub } = require('./helpers/mock-minimax-mcp');
const { readAndValidateImage } = require('../runtimes/photo-color-runtime/lib/image-io');
const minimaxMcp = require('../runtimes/photo-color-runtime/lib/minimax-mcp');
const SAVED_KEY = process.env.OPENAI_API_KEY;
const SAVED_FETCH = global.fetch;
const SAVED_PROVIDER = process.env.FUJIDAY_VLM_PROVIDER;
const SAVED_BASE_URL = process.env.FUJIDAY_VLM_BASE_URL;
const SAVED_API_KEY = process.env.FUJIDAY_VLM_API_KEY;
const SAVED_OLLAMA_HOST = process.env.OLLAMA_HOST;
const SAVED_MODEL = process.env.FUJIDAY_VLM_MODEL;
const SAVED_MINIMAX_KEY = process.env.MINIMAX_API_KEY;
const SAVED_MINIMAX_HOST = process.env.MINIMAX_API_HOST;
const SAVED_MINIMAX_BASE_PATH = process.env.MINIMAX_MCP_BASE_PATH;
const SAVED_SPAWN = childProcess.spawn;

function loadFreshRuntime() {
  delete require.cache[require.resolve(MODULE_PATH)];
  return require(MODULE_PATH);
}

function setup() {
  process.env.OPENAI_API_KEY = 'test-key';
}

function teardown() {
  global.fetch = SAVED_FETCH;
  childProcess.spawn = SAVED_SPAWN;
  minimaxMcp.__private.closeActiveMiniMaxSession();
  if (SAVED_KEY === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = SAVED_KEY;
  if (SAVED_PROVIDER === undefined) delete process.env.FUJIDAY_VLM_PROVIDER;
  else process.env.FUJIDAY_VLM_PROVIDER = SAVED_PROVIDER;
  if (SAVED_BASE_URL === undefined) delete process.env.FUJIDAY_VLM_BASE_URL;
  else process.env.FUJIDAY_VLM_BASE_URL = SAVED_BASE_URL;
  if (SAVED_API_KEY === undefined) delete process.env.FUJIDAY_VLM_API_KEY;
  else process.env.FUJIDAY_VLM_API_KEY = SAVED_API_KEY;
  if (SAVED_OLLAMA_HOST === undefined) delete process.env.OLLAMA_HOST;
  else process.env.OLLAMA_HOST = SAVED_OLLAMA_HOST;
  if (SAVED_MODEL === undefined) delete process.env.FUJIDAY_VLM_MODEL;
  else process.env.FUJIDAY_VLM_MODEL = SAVED_MODEL;
  if (SAVED_MINIMAX_KEY === undefined) delete process.env.MINIMAX_API_KEY;
  else process.env.MINIMAX_API_KEY = SAVED_MINIMAX_KEY;
  if (SAVED_MINIMAX_HOST === undefined) delete process.env.MINIMAX_API_HOST;
  else process.env.MINIMAX_API_HOST = SAVED_MINIMAX_HOST;
  if (SAVED_MINIMAX_BASE_PATH === undefined) delete process.env.MINIMAX_MCP_BASE_PATH;
  else process.env.MINIMAX_MCP_BASE_PATH = SAVED_MINIMAX_BASE_PATH;
  delete process.env.FUJIDAY_VLM_TIMEOUT_MS;
  delete process.env.FUJIDAY_VLM_MAX_RETRIES;
}

async function createFixtureImage(filePath, width = 120, height = 80) {
  await sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 140, b: 160 } }
  }).jpeg().toFile(filePath);
}

async function createExifOrientedFixture(filePath) {
  const left = await sharp({
    create: {
      width: 40,
      height: 40,
      channels: 3,
      background: { r: 220, g: 20, b: 20 }
    }
  }).png().toBuffer();
  const right = await sharp({
    create: {
      width: 40,
      height: 40,
      channels: 3,
      background: { r: 20, g: 20, b: 220 }
    }
  }).png().toBuffer();

  await sharp({
    create: { width: 80, height: 40, channels: 3, background: { r: 0, g: 0, b: 0 } }
  })
    .composite([
      { input: left, left: 0, top: 0 },
      { input: right, left: 40, top: 0 }
    ])
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toFile(filePath);
}

function mockObservationResponse(payload) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify({
      choices: [{ message: { content: JSON.stringify(payload) } }]
    })
  };
}

function observation(overrides = {}) {
  return {
    subject: 'portrait',
    lighting: 'soft daylight',
    contrast_risk: 'medium',
    skin_tone_importance: 'high',
    monochrome_suitability: 'plausible',
    portrait_priority: true,
    high_contrast_scene: false,
    night_scene: false,
    summary: 'Soft daylight portrait with visible face detail.',
    ...overrides
  };
}

test('analyze_image returns observation and recommended styles', async () => {
  setup();
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);
  global.fetch = async () => mockObservationResponse(observation());

  try {
    const result = await runtime.analyze_image({ image_path: imagePath });
    assert.equal(result.status, 'success');
    assert.equal(result.analysis_provider, 'openai');
    assert.equal(result.recommended_styles[0].name, 'ASTIA / Soft');
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('generate_recipe returns recipe without preview by default', async () => {
  setup();
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);
  global.fetch = async () => mockObservationResponse(observation({
    portrait_priority: false,
    skin_tone_importance: 'low',
    subject: 'street'
  }));

  try {
    const result = await runtime.generate_recipe({
      image_path: imagePath,
      selected_style: 'Classic Chrome'
    });
    assert.equal(result.status, 'success');
    assert.equal(result.preview_image_data_uri, null);
    assert.equal(result.recipe.base_film_simulation, 'Classic Chrome');
    assert.equal(result.source_file_deletion, 'disabled');
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('generate_recipe can delete source on request', async () => {
  setup();
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);
  global.fetch = async () => mockObservationResponse(observation({
    portrait_priority: false,
    subject: 'general'
  }));

  try {
    const result = await runtime.generate_recipe({
      image_path: imagePath,
      selected_style: 'PROVIA / Standard',
      delete_after: true
    });
    assert.equal(result.status, 'success');
    assert.equal(result.source_file_deletion, 'deleted');
    await assert.rejects(fs.access(imagePath));
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('generate_recipe leaves the source file in place when analysis fails', async () => {
  setup();
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);
  global.fetch = async () => {
    throw new Error('network down');
  };

  try {
    const result = await runtime.generate_recipe({
      image_path: imagePath,
      selected_style: 'Classic Chrome',
      delete_after: true
    });
    assert.equal(result.status, 'error');
    await fs.access(imagePath);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('output_preview=true returns a JPEG data URI', async () => {
  setup();
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);
  global.fetch = async () => mockObservationResponse(observation({
    portrait_priority: false,
    subject: 'landscape',
    skin_tone_importance: 'low'
  }));

  try {
    const result = await runtime.generate_recipe({
      image_path: imagePath,
      selected_style: 'Velvia / Vivid',
      output_preview: true
    });
    assert.equal(result.status, 'success');
    assert.match(result.preview_image_data_uri, /^data:image\/jpeg;base64,/);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('export_render writes a file to disk', async () => {
  setup();
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  const outPath = path.join(tmpDir, 'out.jpg');
  await createFixtureImage(imagePath);
  global.fetch = async () => mockObservationResponse(observation({
    portrait_priority: false,
    night_scene: true,
    high_contrast_scene: true,
    subject: 'night street',
    lighting: 'night practicals',
    skin_tone_importance: 'low'
  }));

  try {
    const result = await runtime.export_render({
      image_path: imagePath,
      selected_style: 'ETERNA',
      output_path: outPath
    });
    assert.equal(result.status, 'success');
    assert.equal(result.export_path, outPath);
    await fs.access(outPath);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('readAndValidateImage normalizes EXIF orientation before downstream crop logic runs', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-orientation-'));
  const imagePath = path.join(tmpDir, 'oriented.jpg');
  await createExifOrientedFixture(imagePath);

  try {
    const result = await readAndValidateImage(imagePath, 30 * 1024 * 1024);
    assert.equal(result.metadata.width, 40);
    assert.equal(result.metadata.height, 80);

    const { data, info } = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
    const samplePixel = (x, y) => {
      const offset = (y * info.width + x) * info.channels;
      return Array.from(data.slice(offset, offset + info.channels));
    };

    const topPixel = samplePixel(20, 20);
    const bottomPixel = samplePixel(20, 60);
    assert.ok(topPixel[0] > topPixel[2] + 100);
    assert.ok(bottomPixel[2] > bottomPixel[0] + 100);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('compare_styles prefers ASTIA for portrait goals', async () => {
  setup();
  const runtime = loadFreshRuntime();
  try {
    const result = await runtime.compare_styles({
      styles: ['ASTIA / Soft', 'Classic Chrome', 'Velvia / Vivid'],
      textual_goal: 'muted editorial daylight portrait with realistic skin'
    });
    assert.equal(result.status, 'success');
    assert.equal(result.selected_style, 'ASTIA / Soft');
    assert.equal(result.comparisons[0].name, 'ASTIA / Soft');
  } finally {
    teardown();
  }
});

test('generate_recipe accepts numbered style selections from the menu', async () => {
  setup();
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);
  global.fetch = async () => mockObservationResponse(observation());

  try {
    const result = await runtime.generate_recipe({
      image_path: imagePath,
      selected_style: '3'
    });
    assert.equal(result.status, 'success');
    assert.equal(result.selected_style, 'ASTIA / Soft');
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('compare_styles rejects unknown requested styles', async () => {
  setup();
  const runtime = loadFreshRuntime();
  try {
    const result = await runtime.compare_styles({
      styles: ['does-not-exist']
    });
    assert.equal(result.status, 'error');
    assert.equal(result.error_code, 'INPUT_ERROR');
  } finally {
    teardown();
  }
});

test('disabled provider uses local heuristic analysis without fetch', async () => {
  delete process.env.OPENAI_API_KEY;
  process.env.FUJIDAY_VLM_PROVIDER = 'disabled';
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath, 80, 120);
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error('fetch should not be used in disabled mode');
  };

  try {
    const result = await runtime.analyze_image({ image_path: imagePath });
    assert.equal(result.status, 'success');
    assert.equal(result.analysis_provider, 'disabled');
    assert.equal(result.image_observation.analysis_mode, 'heuristic');
    assert.equal(fetchCalled, false);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('openai_compatible provider uses configured base url', async () => {
  delete process.env.OPENAI_API_KEY;
  process.env.FUJIDAY_VLM_PROVIDER = 'openai_compatible';
  process.env.FUJIDAY_VLM_BASE_URL = 'http://127.0.0.1:1234/v1';
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);
  const captured = {};
  global.fetch = async (url, opts) => {
    captured.url = url;
    captured.authorization = opts.headers.Authorization || null;
    return mockObservationResponse(observation());
  };

  try {
    const result = await runtime.generate_recipe({
      image_path: imagePath,
      selected_style: 'Classic Chrome'
    });
    assert.equal(result.status, 'success');
    assert.equal(result.analysis_provider, 'openai_compatible');
    assert.equal(captured.url, 'http://127.0.0.1:1234/v1/chat/completions');
    assert.equal(captured.authorization, null);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('ollama provider uses local Ollama chat endpoint', async () => {
  delete process.env.OPENAI_API_KEY;
  process.env.FUJIDAY_VLM_PROVIDER = 'ollama';
  process.env.OLLAMA_HOST = 'http://127.0.0.1:11434';
  process.env.FUJIDAY_VLM_MODEL = 'llava';
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);
  const captured = {};
  global.fetch = async (url, opts) => {
    captured.url = url;
    captured.body = JSON.parse(opts.body);
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({
        message: {
          content: JSON.stringify(observation({
            portrait_priority: false,
            skin_tone_importance: 'low',
            subject: 'cat by window'
          }))
        }
      })
    };
  };

  try {
    const result = await runtime.generate_recipe({
      image_path: imagePath,
      selected_style: 'PROVIA / Standard'
    });
    assert.equal(result.status, 'success');
    assert.equal(result.analysis_provider, 'ollama');
    assert.equal(captured.url, 'http://127.0.0.1:11434/api/chat');
    assert.equal(captured.body.model, 'llava');
    assert.equal(Array.isArray(captured.body.messages[0].images), true);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('minimax provider uses the official understand_image MCP tool', async () => {
  delete process.env.OPENAI_API_KEY;
  process.env.FUJIDAY_VLM_PROVIDER = 'minimax';
  process.env.MINIMAX_API_KEY = 'minimax-test-key';
  process.env.MINIMAX_API_HOST = 'https://api.minimax.io';
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-minimax-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);
  const captured = {};

  childProcess.spawn = createMiniMaxMcpSpawnStub({
    onToolCall({ prompt, imagePath: requestedImagePath }) {
      captured.prompt = prompt;
      captured.imagePath = requestedImagePath;
      return JSON.stringify(observation({
        portrait_priority: false,
        skin_tone_importance: 'low',
        subject: 'market street'
      }));
    }
  });

  try {
    const result = await runtime.analyze_image({ image_path: imagePath });
    assert.equal(result.status, 'success');
    assert.equal(result.analysis_provider, 'minimax');
    assert.equal(captured.imagePath, imagePath);
    assert.match(captured.prompt, /Fujifilm Film Simulation planning/);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('minimax reuses one MCP session across repeated analyses', async () => {
  delete process.env.OPENAI_API_KEY;
  process.env.FUJIDAY_VLM_PROVIDER = 'minimax';
  process.env.MINIMAX_API_KEY = 'minimax-test-key';
  process.env.MINIMAX_API_HOST = 'https://api.minimax.io';
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-minimax-reuse-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);
  let spawnCount = 0;

  childProcess.spawn = (...args) => {
    spawnCount += 1;
    return createMiniMaxMcpSpawnStub({
      onToolCall() {
        return JSON.stringify(observation({
          portrait_priority: false,
          skin_tone_importance: 'low',
          subject: 'repeatable scene'
        }));
      }
    })(...args);
  };

  try {
    const first = await runtime.analyze_image({ image_path: imagePath });
    const second = await runtime.analyze_image({ image_path: imagePath });
    assert.equal(first.status, 'success');
    assert.equal(second.status, 'success');
    assert.equal(spawnCount, 1);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('generic FujiDay VLM key keeps openai auto-detection ahead of minimax', async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.FUJIDAY_VLM_PROVIDER;
  process.env.FUJIDAY_VLM_API_KEY = 'generic-openai-key';
  process.env.MINIMAX_API_KEY = 'minimax-test-key';
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-provider-order-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);
  let minimaxSpawned = false;
  childProcess.spawn = () => {
    minimaxSpawned = true;
    throw new Error('minimax should not be selected');
  };
  global.fetch = async () => mockObservationResponse(observation({
    portrait_priority: false,
    skin_tone_importance: 'low',
    subject: 'auto-detect scene'
  }));

  try {
    const result = await runtime.analyze_image({ image_path: imagePath });
    assert.equal(result.status, 'success');
    assert.equal(result.analysis_provider, 'openai');
    assert.equal(minimaxSpawned, false);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('openai provider without key falls back to heuristic mode', async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.FUJIDAY_VLM_API_KEY;
  process.env.FUJIDAY_VLM_PROVIDER = 'openai';
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error('fetch should not be called without credentials');
  };

  try {
    const result = await runtime.generate_recipe({
      image_path: imagePath,
      selected_style: 'Classic Chrome'
    });
    assert.equal(result.status, 'success');
    assert.equal(result.analysis_provider, 'disabled');
    assert.match(result.image_observation.analysis_note, /Heuristic fallback was used/);
    assert.equal(fetchCalled, false);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('list_styles gives ACROS a boost only when monochrome is plausible', async () => {
  const runtime = loadFreshRuntime();
  const menu = runtime.list_styles({
    image_observation: observation({
      portrait_priority: false,
      high_contrast_scene: true,
      skin_tone_importance: 'low',
      subject: 'texture scene'
    })
  });
  assert.equal(menu.status, 'success');
  assert.ok(menu.styles.some(item => item.name === 'ACROS'));
});

test('invalid style returns INPUT_ERROR', async () => {
  setup();
  const runtime = loadFreshRuntime();
  try {
    const result = await runtime.generate_recipe({
      image_path: '/tmp/does-not-matter.jpg',
      selected_style: 'Leica'
    });
    assert.equal(result.status, 'error');
    assert.equal(result.error_code, 'INPUT_ERROR');
  } finally {
    teardown();
  }
});

test('non-image files return IMAGE_METADATA_ERROR', async () => {
  setup();
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-'));
  const filePath = path.join(tmpDir, 'not-image.txt');
  await fs.writeFile(filePath, 'hello');

  try {
    const result = await runtime.generate_recipe({
      image_path: filePath,
      selected_style: 'Classic Chrome'
    });
    assert.equal(result.status, 'error');
    assert.equal(result.error_code, 'IMAGE_METADATA_ERROR');
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('VLM timeout returns VLM_TIMEOUT', async () => {
  setup();
  process.env.FUJIDAY_VLM_TIMEOUT_MS = '100';
  process.env.FUJIDAY_VLM_MAX_RETRIES = '0';
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);

  global.fetch = async (_url, opts) => {
    await new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
  };

  try {
    const result = await runtime.generate_recipe({
      image_path: imagePath,
      selected_style: 'Classic Chrome'
    });
    assert.equal(result.status, 'error');
    assert.equal(result.error_code, 'VLM_TIMEOUT');
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
