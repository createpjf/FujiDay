const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const sharp = require('sharp');

const analyzeComposition = require('../commands/analyze-composition');
const exportCrop = require('../commands/export-crop');
const composeFujifilm = require('../commands/compose-fujifilm');

const SAVED_KEY = process.env.OPENAI_API_KEY;
const SAVED_FETCH = global.fetch;
const SAVED_PROVIDER = process.env.FUJIDAY_VLM_PROVIDER;

function createIo() {
  let output = '';
  return {
    stdout: {
      write(chunk) {
        output += chunk;
      }
    },
    getOutput() {
      return output;
    }
  };
}

async function createFixtureImage(filePath, width = 1200, height = 800) {
  await sharp({
    create: { width, height, channels: 3, background: { r: 128, g: 144, b: 160 } }
  }).jpeg().toFile(filePath);
}

function setup() {
  process.env.OPENAI_API_KEY = 'test-key';
  delete process.env.FUJIDAY_VLM_PROVIDER;
}

function teardown() {
  global.fetch = SAVED_FETCH;
  if (SAVED_KEY === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = SAVED_KEY;
  if (SAVED_PROVIDER === undefined) delete process.env.FUJIDAY_VLM_PROVIDER;
  else process.env.FUJIDAY_VLM_PROVIDER = SAVED_PROVIDER;
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

function fetchStub() {
  return async (url, opts) => {
    const body = JSON.parse(opts.body);
    const prompt = body.messages?.[0]?.content?.[0]?.text || '';
    if (prompt.includes('Alex Webb-like composition and cropping')) {
      return mockResponse({
        summary: 'Layered scene.',
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
            coords_norm: [0.08, 0.16, 0.92, 0.84],
            aspect_ratio: '3:2',
            rationale: 'Balanced crop.',
            secondary_crops: []
          },
          narrative: {
            coords_norm: [0.06, 0.18, 0.94, 0.86],
            aspect_ratio: '3:2',
            rationale: 'Narrative crop.',
            secondary_crops: []
          },
          webb_risky: {
            coords_norm: [0.10, 0.12, 0.88, 0.78],
            aspect_ratio: '16:9',
            rationale: 'Risky crop.',
            secondary_crops: []
          }
        }
      });
    }
    if (prompt.includes('Fujifilm Film Simulation planning')) {
      return mockResponse({
        subject: 'street scene',
        lighting: 'soft daylight',
        contrast_risk: 'medium',
        skin_tone_importance: 'low',
        monochrome_suitability: 'plausible',
        portrait_priority: false,
        high_contrast_scene: false,
        night_scene: false,
        summary: 'Documentary crop.'
      });
    }
    throw new Error(`Unexpected prompt: ${prompt}`);
  };
}

test('analyze-composition requires an image path', async () => {
  const io = createIo();
  const code = await analyzeComposition.run([], io);
  const payload = JSON.parse(io.getOutput());
  assert.equal(code, 1);
  assert.equal(payload.error_code, 'INPUT_ERROR');
});

test('export-crop without mode returns crop mode selection', async () => {
  setup();
  global.fetch = fetchStub();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-cmd-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);

  try {
    const io = createIo();
    const code = await exportCrop.run(['--image', imagePath], io);
    const payload = JSON.parse(io.getOutput());
    assert.equal(code, 0);
    assert.equal(payload.status, 'selection_required');
    assert.equal(payload.crop_modes.length, 3);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('compose-fujifilm without mode returns crop mode selection', async () => {
  setup();
  global.fetch = fetchStub();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-cmd-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);

  try {
    const io = createIo();
    const code = await composeFujifilm.run(['--image', imagePath], io);
    const payload = JSON.parse(io.getOutput());
    assert.equal(code, 0);
    assert.equal(payload.status, 'selection_required');
    assert.equal(payload.crop_modes.length, 3);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('compose-fujifilm without Fujifilm style returns style selection after crop', async () => {
  setup();
  global.fetch = fetchStub();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-cmd-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);

  try {
    const io = createIo();
    const code = await composeFujifilm.run(['--image', imagePath, '--mode', 'balanced'], io);
    const payload = JSON.parse(io.getOutput());
    assert.equal(code, 0);
    assert.equal(payload.status, 'selection_required');
    assert.equal(payload.recommended_fujifilm_styles.length, 3);
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('export-crop without mode fails fast when auto-crop export is unavailable', async () => {
  delete process.env.OPENAI_API_KEY;
  process.env.FUJIDAY_VLM_PROVIDER = 'disabled';
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-cmd-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);

  try {
    const io = createIo();
    const code = await exportCrop.run(['--image', imagePath], io);
    const payload = JSON.parse(io.getOutput());
    assert.equal(code, 1);
    assert.equal(payload.error_code, 'VLM_REQUIRED_FOR_CROP_EXPORT');
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('compose-fujifilm without mode fails fast when crop export is unavailable', async () => {
  delete process.env.OPENAI_API_KEY;
  process.env.FUJIDAY_VLM_PROVIDER = 'disabled';
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fujiday-cmd-'));
  const imagePath = path.join(tmpDir, 'in.jpg');
  await createFixtureImage(imagePath);

  try {
    const io = createIo();
    const code = await composeFujifilm.run(['--image', imagePath], io);
    const payload = JSON.parse(io.getOutput());
    assert.equal(code, 1);
    assert.equal(payload.error_code, 'VLM_REQUIRED_FOR_CROP_EXPORT');
  } finally {
    teardown();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
