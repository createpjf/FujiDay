const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const childProcess = require('node:child_process');
const sharp = require('sharp');

const MODULE_PATH = '../runtimes/photo-composition-runtime';
const { createMiniMaxMcpSpawnStub } = require('./helpers/mock-minimax-mcp');
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
  delete require.cache[require.resolve('../runtimes/photo-color-runtime')];
  return require(MODULE_PATH);
}

function setup() {
  process.env.OPENAI_API_KEY = 'test-key';
  delete process.env.FUJIDAY_VLM_PROVIDER;
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

async function createFixtureImage(filePath, width = 1280, height = 853) {
  const left = await sharp({
    create: {
      width: Math.floor(width * 0.35),
      height,
      channels: 3,
      background: { r: 176, g: 196, b: 214 }
    }
  }).png().toBuffer();
  const center = await sharp({
    create: {
      width: Math.floor(width * 0.3),
      height,
      channels: 3,
      background: { r: 112, g: 128, b: 144 }
    }
  }).png().toBuffer();
  const right = await sharp({
    create: {
      width: width - Math.floor(width * 0.35) - Math.floor(width * 0.3),
      height,
      channels: 3,
      background: { r: 214, g: 210, b: 186 }
    }
  }).png().toBuffer();

  await sharp({
    create: { width, height, channels: 3, background: { r: 140, g: 150, b: 160 } }
  })
    .composite([
      { input: left, left: 0, top: 0 },
      { input: center, left: Math.floor(width * 0.35), top: 0 },
      { input: right, left: Math.floor(width * 0.65), top: 0 }
    ])
    .jpeg()
    .toFile(filePath);
}

function compositionObservation(overrides = {}) {
  return {
    summary: 'Layered outdoor public scene with readable foreground, midground car, and distant figure.',
    foreground_strength: 'high',
    midground_strength: 'high',
    background_strength: 'medium',
    subject_separation: 'medium',
    color_tension: 'medium',
    light_tension: 'medium',
    narrative_density: 'high',
    edge_pressure: 'medium',
    webb_fit: 'medium',
    crop_candidates: {
      balanced: {
        coords_norm: [0.06, 0.18, 0.92, 0.84],
        aspect_ratio: '3:2',
        rationale: 'Reduce dead sky and scattered lower clutter while preserving all three planes.',
        secondary_crops: [
          {
            coords_norm: [0.10, 0.20, 0.88, 0.82],
            aspect_ratio: '4:5',
            rationale: 'Slightly tighter balanced crop with less right-edge distraction.'
          }
        ]
      },
      narrative: {
        coords_norm: [0.04, 0.20, 0.94, 0.86],
        aspect_ratio: '3:2',
        rationale: 'Keep the moving subject, the central anchor, and the quieter distant actor together.',
        secondary_crops: []
      },
      webb_risky: {
        coords_norm: [0.10, 0.14, 0.88, 0.78],
        aspect_ratio: '16:9',
        rationale: 'Push edge pressure and density harder for a riskier layered read.',
        secondary_crops: []
      }
    },
    ...overrides
  };
}

function colorObservation(overrides = {}) {
  return {
    subject: 'street scene',
    lighting: 'soft daylight',
    contrast_risk: 'medium',
    skin_tone_importance: 'low',
    monochrome_suitability: 'plausible',
    portrait_priority: false,
    high_contrast_scene: false,
    night_scene: false,
    summary: 'Cropped public scene with a documentary feel.',
    ...overrides
  };
}

function mockResponse(payload) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => JSON.stringify({
      choices: [{ message: { content: JSON.stringify(payload) } }]
    })
  };
}

function makeFetchStub() {
  return async (url, opts) => {
    const body = JSON.parse(opts.body);
    const prompt = body.messages?.[0]?.content?.[0]?.text || '';
    if (prompt.includes('Alex Webb-like composition and cropping')) {
      return mockResponse(compositionObservation());
    }
    if (prompt.includes('Fujifilm Film Simulation planning')) {
      return mockResponse(colorObservation());
    }
    throw new Error(`Unexpected prompt: ${prompt}`);
  };
}

test('analyze_composition returns observation, webb fit, and crop modes', async () => {
  setup();
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-comp-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);
  global.fetch = makeFetchStub();

  try {
    const result = await runtime.analyze_composition({ image_path: imagePath });
    assert.equal(result.status, 'success');
    assert.equal(result.analysis_provider, 'openai');
    assert.equal(result.webb_fit, 'medium');
    assert.equal(result.recommended_crop_modes.length, 3);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('analyze_composition uses heuristic mode when provider is disabled', async () => {
  delete process.env.OPENAI_API_KEY;
  process.env.FUJIDAY_VLM_PROVIDER = 'disabled';
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-comp-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath, 720, 1080);
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error('fetch should not run');
  };

  try {
    const result = await runtime.analyze_composition({ image_path: imagePath });
    assert.equal(result.status, 'success');
    assert.equal(result.analysis_provider, 'disabled');
    assert.equal(result.composition_observation.analysis_mode, 'heuristic');
    assert.equal(fetchCalled, false);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('recommend_crop returns crop plan and Fujifilm recommendations', async () => {
  setup();
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-comp-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);
  global.fetch = makeFetchStub();

  try {
    const result = await runtime.recommend_crop({
      image_path: imagePath,
      crop_mode: 'narrative'
    });
    assert.equal(result.status, 'success');
    assert.equal(result.selected_crop_mode, 'narrative');
    assert.equal(result.crop_plan.aspect_ratio, '3:2');
    assert.ok(result.crop_plan.crop_pixels.width > 0);
    assert.equal(result.recommended_fujifilm_styles.length, 3);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('recommend_crop works with the minimax provider and re-analyzes the cropped buffer', async () => {
  delete process.env.OPENAI_API_KEY;
  process.env.FUJIDAY_VLM_PROVIDER = 'minimax';
  process.env.MINIMAX_API_KEY = 'minimax-test-key';
  process.env.MINIMAX_API_HOST = 'https://api.minimax.io';
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-comp-minimax-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);
  const requestedPaths = [];
  let spawnCount = 0;
  childProcess.spawn = (...args) => {
    spawnCount += 1;
    return createMiniMaxMcpSpawnStub({
      onToolCall({ prompt, imagePath: requestedImagePath }) {
        requestedPaths.push(requestedImagePath);

        if (prompt.includes('Alex Webb-like composition and cropping')) {
          return JSON.stringify(compositionObservation());
        }

        if (prompt.includes('Fujifilm Film Simulation planning')) {
          return JSON.stringify(colorObservation());
        }

        throw new Error(`Unexpected prompt: ${prompt}`);
      }
    })(...args);
  };

  try {
    const result = await runtime.recommend_crop({
      image_path: imagePath,
      crop_mode: 'balanced'
    });
    assert.equal(result.status, 'success');
    assert.equal(result.analysis_provider, 'minimax');
    assert.equal(result.recommended_fujifilm_styles.length, 3);
    assert.equal(requestedPaths[0], imagePath);
    assert.notEqual(requestedPaths[1], imagePath);
    assert.equal(path.basename(requestedPaths[1]), 'crop.jpg');
    assert.equal(spawnCount, 1);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('export_crop writes a cropped file to disk', async () => {
  setup();
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-comp-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  const outPath = path.join(tmpDir, 'crop.jpg');
  await createFixtureImage(imagePath);
  global.fetch = makeFetchStub();

  try {
    const result = await runtime.export_crop({
      image_path: imagePath,
      crop_mode: 'balanced',
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

test('export_crop returns explicit error when provider is disabled', async () => {
  delete process.env.OPENAI_API_KEY;
  process.env.FUJIDAY_VLM_PROVIDER = 'disabled';
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-comp-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);

  try {
    const result = await runtime.export_crop({ image_path: imagePath });
    assert.equal(result.status, 'error');
    assert.equal(result.error_code, 'VLM_REQUIRED_FOR_CROP_EXPORT');
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('compose_fujifilm returns selection_required when Fujifilm style is missing', async () => {
  setup();
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-comp-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);
  global.fetch = makeFetchStub();

  try {
    const result = await runtime.compose_fujifilm({
      image_path: imagePath,
      crop_mode: 'balanced'
    });
    assert.equal(result.status, 'selection_required');
    assert.equal(result.selected_crop_mode, 'balanced');
    assert.equal(result.recommended_fujifilm_styles.length, 3);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('compose_fujifilm exports a final composed Fujifilm render', async () => {
  setup();
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-comp-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  const outPath = path.join(tmpDir, 'final.jpg');
  await createFixtureImage(imagePath);
  global.fetch = makeFetchStub();

  try {
    const result = await runtime.compose_fujifilm({
      image_path: imagePath,
      crop_mode: 'narrative',
      selected_style: 'Classic Chrome',
      output_path: outPath
    });
    assert.equal(result.status, 'success');
    assert.equal(result.composition.selected_crop_mode, 'narrative');
    assert.equal(result.grading.status, 'success');
    assert.equal(result.final_export_path, outPath);
    await fs.access(outPath);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('compose_fujifilm with minimax reuses one session and avoids a duplicate cropped-image analysis', async () => {
  delete process.env.OPENAI_API_KEY;
  process.env.FUJIDAY_VLM_PROVIDER = 'minimax';
  process.env.MINIMAX_API_KEY = 'minimax-test-key';
  process.env.MINIMAX_API_HOST = 'https://api.minimax.io';
  const runtime = loadFreshRuntime();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-compose-minimax-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  const outPath = path.join(tmpDir, 'final.jpg');
  await createFixtureImage(imagePath);
  let spawnCount = 0;
  const prompts = [];

  childProcess.spawn = (...args) => {
    spawnCount += 1;
    return createMiniMaxMcpSpawnStub({
      onToolCall({ prompt }) {
        prompts.push(prompt);

        if (prompt.includes('Alex Webb-like composition and cropping')) {
          return JSON.stringify(compositionObservation());
        }

        if (prompt.includes('Fujifilm Film Simulation planning')) {
          return JSON.stringify(colorObservation());
        }

        throw new Error(`Unexpected prompt: ${prompt}`);
      }
    })(...args);
  };

  try {
    const result = await runtime.compose_fujifilm({
      image_path: imagePath,
      crop_mode: 'balanced',
      selected_style: 'Classic Chrome',
      output_path: outPath
    });
    assert.equal(result.status, 'success');
    assert.equal(spawnCount, 1);
    assert.equal(prompts.filter(prompt => prompt.includes('Alex Webb-like composition and cropping')).length, 1);
    assert.equal(prompts.filter(prompt => prompt.includes('Fujifilm Film Simulation planning')).length, 1);
    await fs.access(outPath);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
