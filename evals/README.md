# FujiDay Evals

FujiDay evals have two parts:

1. `fujiday-v1-manifest.json`
   A 30-scene fixture manifest covering portrait, street, travel, night, high contrast, monochrome, and mixed-light cases.
2. `skills-pressure-tests.json`
   Ten ambiguous requests used to verify that FujiDay skills still honor menu gating and source hierarchy.

`generate-synthetic-fixtures.js` creates deterministic placeholder fixtures so the eval runner has stable local image paths in development.
