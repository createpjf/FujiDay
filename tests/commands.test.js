const test = require('node:test');
const assert = require('node:assert/strict');
const buildStylePack = require('../commands/build-style-pack');
const compareFujifilm = require('../commands/compare-fujifilm');
const gradeFujifilm = require('../commands/grade-fujifilm');

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

test('build-style-pack validates the bundled Fujifilm style pack', async () => {
  const io = createIo();
  const code = await buildStylePack.run([], io);
  const payload = JSON.parse(io.getOutput());
  assert.equal(code, 0);
  assert.equal(payload.status, 'success');
  assert.ok(payload.families.length >= 2);
  assert.ok(payload.families.find(item => item.family === 'fujifilm').style_count >= 7);
  assert.ok(payload.families.find(item => item.family === 'composition').crop_mode_count >= 3);
});

test('grade-fujifilm requires an image path', async () => {
  const io = createIo();
  const code = await gradeFujifilm.run([], io);
  const payload = JSON.parse(io.getOutput());
  assert.equal(code, 1);
  assert.equal(payload.error_code, 'INPUT_ERROR');
});

test('compare-fujifilm rejects unknown style names', async () => {
  const io = createIo();
  const code = await compareFujifilm.run(['--styles', 'does-not-exist'], io);
  const payload = JSON.parse(io.getOutput());
  assert.equal(code, 1);
  assert.equal(payload.error_code, 'INPUT_ERROR');
});
