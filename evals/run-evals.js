const fs = require('node:fs');
const path = require('node:path');
const manifest = require('./fujiday-v1-manifest.json');
const pressureTests = require('./skills-pressure-tests.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  assert(manifest.length >= 30, 'Eval manifest must contain at least 30 fixtures.');
  assert(pressureTests.length >= 10, 'Pressure test manifest must contain at least 10 prompts.');

  for (const item of manifest) {
    assert(Array.isArray(item.expected_top_styles) && item.expected_top_styles.length >= 2, `Missing expectations for ${item.id}.`);
  }

  const root = path.resolve(__dirname, '..');
  const missingFixtures = manifest
    .map(item => path.join(root, item.fixture_path))
    .filter(filePath => !fs.existsSync(filePath));

  const result = {
    status: 'success',
    eval_fixture_count: manifest.length,
    pressure_prompt_count: pressureTests.length,
    missing_fixture_count: missingFixtures.length,
    missing_fixtures: missingFixtures.slice(0, 5)
  };

  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    status: 'error',
    error_code: 'EVAL_CHECK_ERROR',
    message: error.message
  }, null, 2));
  process.exitCode = 1;
}
