const catalog = require('../../../style-packs/fujifilm/catalog.json');
const adjustmentRules = require('../../../style-packs/fujifilm/adjustment-rules.json');

const STYLE_BY_NAME = new Map(catalog.styles.map(style => [style.name, style]));
const STYLE_ALIASES = catalog.styles.reduce((map, style) => {
  map.set(style.name.toLowerCase(), style.name);
  for (const alias of style.aliases) map.set(alias.toLowerCase(), style.name);
  return map;
}, new Map());

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeSelectedStyle(input) {
  if (typeof input !== 'string' || input.trim().length === 0) return null;
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    const index = Number(trimmed) - 1;
    return catalog.styles[index]?.name || null;
  }
  return STYLE_ALIASES.get(trimmed.toLowerCase()) || null;
}

function defaultObservation() {
  return {
    subject: 'general scene',
    lighting: 'unknown light',
    contrast_risk: 'medium',
    skin_tone_importance: 'medium',
    monochrome_suitability: 'plausible',
    portrait_priority: false,
    high_contrast_scene: false,
    night_scene: false,
    summary: ''
  };
}

function normalizeObservation(input = {}) {
  return {
    ...defaultObservation(),
    ...input
  };
}

function inferObservationFromText(textualGoal = '') {
  const text = typeof textualGoal === 'string' ? textualGoal.toLowerCase() : '';
  const observation = defaultObservation();

  if (text.includes('portrait') || text.includes('skin') || text.includes('editorial')) {
    observation.subject = 'portrait';
    observation.portrait_priority = true;
    observation.skin_tone_importance = 'high';
  }
  if (text.includes('night') || text.includes('evening') || text.includes('cinematic')) {
    observation.night_scene = true;
    observation.lighting = 'night or dim light';
  }
  if (text.includes('high contrast') || text.includes('hard light') || text.includes('urban documentary')) {
    observation.high_contrast_scene = true;
    observation.contrast_risk = 'high';
  }
  if (text.includes('black and white') || text.includes('monochrome')) {
    observation.monochrome_suitability = 'plausible';
  }
  observation.summary = textualGoal || observation.summary;
  return observation;
}

function scoreStyle(style, observation) {
  let score =
    (observation.portrait_priority ? style.ranking_bias.portrait_priority : 0) +
    (observation.high_contrast_scene ? style.ranking_bias.high_contrast_scene : 0) +
    (observation.night_scene ? style.ranking_bias.night_scene : 0) +
    (observation.monochrome_suitability === 'plausible' ? style.ranking_bias.monochrome_candidate : 0);

  const reasons = [];
  if (observation.portrait_priority && style.ranking_bias.portrait_priority > 0) reasons.push('portrait fit');
  if (observation.high_contrast_scene && style.ranking_bias.high_contrast_scene > 0) reasons.push('contrast control');
  if (observation.night_scene && style.ranking_bias.night_scene > 0) reasons.push('night usability');
  if (observation.monochrome_suitability === 'plausible' && style.ranking_bias.monochrome_candidate > 0) reasons.push('monochrome potential');

  // Monochrome plausibility should not overpower a strong color-portrait signal.
  if (style.name === 'ACROS' && observation.portrait_priority && observation.skin_tone_importance === 'high') {
    score -= 4;
  }

  return { score, reason: reasons.join(', ') || 'general Fujifilm fit' };
}

function listStyles({ imageObservation, family = 'fujifilm', textualGoal = '' } = {}) {
  if (family !== 'fujifilm') {
    throw new Error('FujiDay v1 only supports the fujifilm family.');
  }

  const observation = imageObservation
    ? normalizeObservation(imageObservation)
    : inferObservationFromText(textualGoal);

  const styles = catalog.styles
    .map(style => {
      const scored = scoreStyle(style, observation);
      return {
        name: style.name,
        summary: style.summary,
        menu_blurb: style.menu_blurb,
        recommended_reason: scored.reason,
        score: scored.score
      };
    })
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .map((style, index) => ({
      ...style,
      recommended_rank: index + 1
    }));

  return {
    family,
    image_observation: observation,
    styles
  };
}

function softenHighlight(current) {
  if (current === '0') return '-1';
  if (current === '-1') return '-2';
  return current;
}

function drValueToNumber(value) {
  if (value === 'DR400') return 400;
  if (value === 'DR200') return 200;
  return 100;
}

function maxDynamicRange(left, right) {
  return drValueToNumber(left) >= drValueToNumber(right) ? left : right;
}

function buildNextTest(styleName, observation) {
  if (observation.portrait_priority) {
    return `Keep ${styleName} fixed and compare Shadow ${styleName === 'Classic Chrome' ? '0' : '-1'} against Shadow +0 only for skin transitions.`;
  }
  if (observation.high_contrast_scene) {
    return `Keep ${styleName} fixed and compare DR200 against DR400 while holding WB and Shadow constant.`;
  }
  if (observation.night_scene) {
    return `Keep ${styleName} fixed and compare Shadow 0 against Shadow +1 only to judge night readability without changing color.`;
  }
  return `Keep ${styleName} fixed and compare the current WB shift against a neutral WB shift only.`;
}

function buildRecipeFromObservation(styleName, imageObservation) {
  const observation = normalizeObservation(imageObservation);
  const style = STYLE_BY_NAME.get(styleName);
  if (!style) {
    throw new Error(`Unknown style ${styleName}`);
  }

  const recipe = clone(style.default_recipe);
  const adjustmentNotes = [];

  if (observation.portrait_priority) {
    const portraitRule = adjustmentRules.portrait_priority[styleName];
    if (portraitRule?.set) Object.assign(recipe, portraitRule.set);
    if (portraitRule?.note) adjustmentNotes.push(portraitRule.note);
  }

  if (observation.high_contrast_scene) {
    const drRule = adjustmentRules.high_contrast_scene.dynamic_range_by_style[styleName] ||
      adjustmentRules.high_contrast_scene.dynamic_range_by_style['*'];
    recipe.dynamic_range = drRule;
    if (adjustmentRules.high_contrast_scene.soften_highlight_once) {
      recipe.highlight = softenHighlight(recipe.highlight);
    }
    adjustmentNotes.push(adjustmentRules.high_contrast_scene.note);
  }

  if (observation.night_scene) {
    const nightRule = adjustmentRules.night_scene[styleName];
    if (nightRule?.set) Object.assign(recipe, nightRule.set);
    if (nightRule?.ensure_min_dynamic_range) {
      recipe.dynamic_range = maxDynamicRange(recipe.dynamic_range, nightRule.ensure_min_dynamic_range);
    }
    if (nightRule?.note) adjustmentNotes.push(nightRule.note);
  }

  if (styleName === 'ACROS' && observation.monochrome_suitability === 'not_recommended') {
    adjustmentNotes.push(adjustmentRules.monochrome_candidate.ACROS.when_false_note);
  }

  const rationaleParts = [
    `${styleName} was selected as the target Fujifilm style.`,
    style.summary
  ];
  if (observation.summary) rationaleParts.push(`Image read: ${observation.summary}`);
  if (adjustmentNotes.length > 0) {
    rationaleParts.push(`Adjustments: ${adjustmentNotes.join(' ')}`);
  } else {
    rationaleParts.push('No additional scene-driven shifts were required beyond the default recipe start point.');
  }

  return {
    recipe,
    bestUseCases: style.best_use_cases,
    failureCases: style.failure_cases,
    compatibilityNotes: style.compatibility_notes,
    rationale: rationaleParts.join(' '),
    nextTestToRun: buildNextTest(styleName, observation),
    previewPreset: clone(style.preview_preset)
  };
}

function compareStyleSet({ styles, imageObservation, textualGoal = '' }) {
  const observation = imageObservation
    ? normalizeObservation(imageObservation)
    : inferObservationFromText(textualGoal);

  const requested = Array.isArray(styles) && styles.length > 0
    ? styles.map(normalizeSelectedStyle).filter(Boolean)
    : listStyles({ imageObservation: observation }).styles.slice(0, 3).map(item => item.name);

  const comparisons = requested.map(name => {
    const style = STYLE_BY_NAME.get(name);
    const scored = scoreStyle(style, observation);
    return {
      name,
      summary: style.summary,
      style_bucket: style.style_bucket,
      best_use_cases: style.best_use_cases,
      failure_cases: style.failure_cases,
      compatibility_notes: style.compatibility_notes,
      fit_score: scored.score,
      fit_reason: scored.reason
    };
  }).sort((left, right) => right.fit_score - left.fit_score || left.name.localeCompare(right.name));

  return {
    image_observation: observation,
    requested_styles: requested,
    recommended_style: comparisons[0]?.name || null,
    comparisons
  };
}

function getStylePackSummary() {
  return {
    family: catalog.family,
    version: catalog.version,
    style_count: catalog.styles.length,
    styles: catalog.styles.map(style => ({
      name: style.name,
      aliases: style.aliases,
      summary: style.summary
    }))
  };
}

module.exports = {
  catalog,
  adjustmentRules,
  normalizeSelectedStyle,
  listStyles,
  buildRecipeFromObservation,
  compareStyleSet,
  getStylePackSummary,
  inferObservationFromText
};
