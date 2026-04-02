const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../evals/fujiday-v1-manifest.json');
const pressureTests = require('../evals/skills-pressure-tests.json');
const compositionManifest = require('../evals/composition-v1-manifest.json');
const compositionPressureTests = require('../evals/composition-skills-pressure-tests.json');

const ROOT = path.resolve(__dirname, '..');
const REQUIRED_SKILLS = [
  'using-fujiday',
  'routing-color-tasks',
  'choosing-fujifilm-style',
  'choosing-fujifilm-workflow',
  'routing-composition-tasks',
  'choosing-crop-mode',
  'analyzing-webb-composition',
  'exporting-crops',
  'chaining-composition-to-fujifilm',
  'validating-composition-results',
  'writing-composition-style-packs',
  'generating-fujifilm-recipe',
  'rendering-color-preview',
  'exporting-color-renders',
  'comparing-color-looks',
  'debugging-color-pipeline',
  'validating-color-results',
  'writing-style-packs'
];

test('FujiDay ships the required skill collection', () => {
  for (const name of REQUIRED_SKILLS) {
    const filePath = path.join(ROOT, 'skills', name, 'SKILL.md');
    assert.equal(fs.existsSync(filePath), true, `Missing ${name}`);
  }
});

test('eval manifest includes at least 30 fixtures', () => {
  assert.ok(manifest.length >= 30);
});

test('pressure test manifest includes at least 10 prompts', () => {
  assert.ok(pressureTests.length >= 10);
});

test('composition eval manifest includes at least 12 scenarios', () => {
  assert.ok(compositionManifest.length >= 12);
});

test('composition pressure manifest includes at least 10 prompts', () => {
  assert.ok(compositionPressureTests.length >= 10);
});
