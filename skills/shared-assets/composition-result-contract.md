# FujiDay Composition Result Contract

Composition analysis results should include:

- `status`
- `analysis_provider`
- `composition_style`
- `composition_observation`
- `webb_fit`
- `recommended_crop_modes`

Crop recommendation or export results should include:

- `status`
- `analysis_provider`
- `composition_style`
- `composition_observation`
- `selected_crop_mode`
- `crop_plan`
- `recommended_fujifilm_styles`

Crop exports should also include:

- `export_path`
- `source_file_deletion`

Composition-to-Fujifilm chain results should include either:

- `status: selection_required`
- `crop_plan`
- `recommended_fujifilm_styles`

or:

- `status: success`
- `composition`
- `grading`
- `final_export_path`
