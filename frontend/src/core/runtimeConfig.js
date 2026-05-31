import { load } from 'js-yaml';
import rawFrontendConfig from '../../config.yaml?raw';

const DEFAULT_CONFIG = {
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

function buildRuntimeConfig() {
  try {
    const parsed = load(rawFrontendConfig) || {};

    return {
      ...DEFAULT_CONFIG,
      ...parsed,
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
