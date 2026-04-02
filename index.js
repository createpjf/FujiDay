const colorRuntime = require('./runtimes/photo-color-runtime');
const compositionRuntime = require('./runtimes/photo-composition-runtime');

module.exports = {
  ...colorRuntime,
  ...compositionRuntime,
  color_runtime: colorRuntime,
  composition_runtime: compositionRuntime
};
