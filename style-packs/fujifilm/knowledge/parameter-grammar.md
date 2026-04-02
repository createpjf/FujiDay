# Parameter Grammar

FujiDay describes recipe changes in causal terms:

- `wb`
  Chooses the overall white-balance anchor.
- `wb_shift`
  Fine-tunes warmth, coolness, and color bias around the WB anchor.
- `highlight`
  Changes the bright-end contrast skeleton.
- `shadow`
  Changes the dark-end contrast skeleton.
- `color`
  Pushes overall saturation.
- `grain`
  Adds texture and analog roughness.
- `dynamic_range`
  Preserves highlights by flattening the tonal response.
- `color_chrome`
  Deepens color separation, especially in saturated tones.
- `color_chrome_fx_blue`
  Adds control over blues when supported.
- `clarity` and `sharpness`
  Affect edge acuity and crispness, but should not be confused with the core film-simulation look.

FujiDay always explains which settings are doing the heavy lifting.
