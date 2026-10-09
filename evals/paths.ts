export const CACHE_DIR = 'evals/.cache';

export const DB_PATHS = {
  golden: `${CACHE_DIR}/golden.db`,
  hostile: `${CACHE_DIR}/hostile.db`,
} as const;

export type Suite = keyof typeof DB_PATHS;
