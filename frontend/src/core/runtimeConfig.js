import { load } from 'js-yaml';
import rawFrontendConfig from '../../config.yaml?raw';

const DEFAULT_CONFIG = {
  conflict: {
    warning_threshold: 3,
    warning_opacity: 0.15,
    warning_position: 'bottom-right',
    warning_font_size: 0.75,
  },
  meta: {
    base_probability: 0.1,
    obsession_factor: 0.5,
  },
  game: {
    questions_per_round: 20,
    conflict_window_size: 5,
  },
};

function toSafePositiveInt(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
}

function toSafeFloat(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

function buildRuntimeConfig() {
  try {
    const parsed = load(rawFrontendConfig) || {};

    return {
      conflict: {
        ...DEFAULT_CONFIG.conflict,
        ...(parsed.conflict || {}),
        warning_threshold: toSafePositiveInt(
          parsed?.conflict?.warning_threshold,
          DEFAULT_CONFIG.conflict.warning_threshold
        ),
        warning_opacity: toSafeFloat(
          parsed?.conflict?.warning_opacity,
          DEFAULT_CONFIG.conflict.warning_opacity
        ),
        warning_font_size: toSafeFloat(
          parsed?.conflict?.warning_font_size,
          DEFAULT_CONFIG.conflict.warning_font_size
        ),
      },
      meta: {
        ...DEFAULT_CONFIG.meta,
        ...(parsed.meta || {}),
        base_probability: toSafeFloat(
          parsed?.meta?.base_probability,
          DEFAULT_CONFIG.meta.base_probability
        ),
        obsession_factor: toSafeFloat(
          parsed?.meta?.obsession_factor,
          DEFAULT_CONFIG.meta.obsession_factor
        ),
      },
      game: {
        ...DEFAULT_CONFIG.game,
        ...(parsed.game || {}),
        questions_per_round: toSafePositiveInt(
          parsed?.game?.questions_per_round,
          DEFAULT_CONFIG.game.questions_per_round
        ),
        conflict_window_size: toSafePositiveInt(
          parsed?.game?.conflict_window_size,
          DEFAULT_CONFIG.game.conflict_window_size
        ),
      },
    };
  } catch (error) {
    console.warn('[Config] Failed to parse frontend/config.yaml, fallback to defaults.', error);
    return DEFAULT_CONFIG;
  }
}

const runtimeConfig = buildRuntimeConfig();

export { runtimeConfig };
