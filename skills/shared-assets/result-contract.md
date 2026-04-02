# FujiDay Success Contract

Every runtime-backed grading result should include:

- `status`
- `analysis_provider`
- `selected_style`
- `selected_target_style`
- `image_observation`
- `recipe`
- `rationale`
- `best_use_cases`
- `failure_cases`
- `compatibility_notes`
- `next_test_to_run`
- `preview_note`
- `preview_image_data_uri`
- `export_path`
- `source_file_deletion`
- `source_file_deletion_message`

Failures should include:

- `status: error`
- `error_code`
- `message`
- `details`
