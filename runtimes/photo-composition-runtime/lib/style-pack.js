const catalog = require('../../../style-packs/composition/alex-webb/catalog.json');
const cropModes = require('../../../style-packs/composition/alex-webb/crop-modes.json');
const scoringRules = require('../../../style-packs/composition/alex-webb/scoring-rules.json');

const STYLE_ALIASES = catalog.styles.reduce((map, style) => {
  map.set(style.name.toLowerCase(), style.name);
  for (const alias of style.aliases) map.set(alias.toLowerCase(), style.name);
  return map;
}, new Map());
const MODE_BY_NAME = new Map(cropModes.modes.map(mode => [mode.name, mode]));

const OBSERVATION_FIELDS = [
  'foreground_strength',
  'midground_strength',
  'background_strength',
  'subject_separation',
  'color_tension',
  'light_tension',
  'narrative_density',
  'edge_pressure'
];

function normalizeCompositionStyle(input) {
  if (typeof input !== 'string' || input.trim().length === 0) return null;
  return STYLE_ALIASES.get(input.trim().toLowerCase()) || null;
}

function normalizeCropMode(input) {
  if (typeof input !== 'string' || input.trim().length === 0) return null;
  return MODE_BY_NAME.has(input.trim()) ? input.trim() : null;
}

function enumWeight(value) {
  return scoringRules.enum_weights[value] || 0;
}

function getModeWeights(modeName) {
  return scoringRules.crop_mode_weights[modeName] || {};
}

function normalizeObservation(observation = {}) {
  return {
    foreground_strength: observation.foreground_strength || 'low',
    midground_strength: observation.midground_strength || 'low',
    background_strength: observation.background_strength || 'low',
    subject_separation: observation.subject_separation || 'low',
    color_tension: observation.color_tension || 'low',
    light_tension: observation.light_tension || 'low',
    narrative_density: observation.narrative_density || 'low',
    edge_pressure: observation.edge_pressure || 'low',
    webb_fit: observation.webb_fit || 'low',
    summary: observation.summary || '',
    analysis_provider: observation.analysis_provider || null,
    analysis_mode: observation.analysis_mode || null,
    analysis_note: observation.analysis_note || null,
    crop_candidates: observation.crop_candidates || null
  };
}

function buildReason(weights, observation) {
  const topFields = OBSERVATION_FIELDS
    .map(field => ({
      field,
      contribution: (weights[field] || 0) * enumWeight(observation[field])
    }))
    .filter(item => item.contribution > 0)
    .sort((left, right) => right.contribution - left.contribution)
    .slice(0, 2)
    .map(item => item.field.replace(/_/g, ' '));

  return topFields.length > 0
    ? `Recommended by ${topFields.join(' + ')}.`
    : 'Recommended as a general-purpose crop mode.';
}

function listCropModes({ compositionObservation, compositionStyle = 'alex-webb' } = {}) {
  const normalizedStyle = normalizeCompositionStyle(compositionStyle);
  if (!normalizedStyle) {
    throw new Error('Unsupported composition_style.');
  }

  const observation = normalizeObservation(compositionObservation);
  const styles = cropModes.modes
    .map(mode => {
      const weights = getModeWeights(mode.name);
      const score = OBSERVATION_FIELDS.reduce((sum, field) => {
        return sum + (weights[field] || 0) * enumWeight(observation[field]);
      }, 0);

      return {
        name: mode.name,
        summary: mode.summary,
        menu_blurb: mode.menu_blurb,
        default_aspect_ratio: mode.default_aspect_ratio,
        recommended_reason: buildReason(weights, observation),
        score
      };
    })
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .map((mode, index) => ({
      ...mode,
      recommended_rank: index + 1
    }));

  return {
    family: catalog.family,
    composition_style: normalizedStyle,
    crop_modes: styles
  };
}

function getCropMode(modeName) {
  return MODE_BY_NAME.get(modeName) || null;
}

function getStyleSummary() {
  return {
    family: catalog.family,
    version: catalog.version,
    styles: catalog.styles.map(style => ({
      name: style.name,
      aliases: style.aliases,
      summary: style.summary
    }))
  };
}

module.exports = {
  catalog,
  cropModes,
  scoringRules,
  normalizeCompositionStyle,
  normalizeCropMode,
  normalizeObservation,
  listCropModes,
  getCropMode,
  getStyleSummary
};
