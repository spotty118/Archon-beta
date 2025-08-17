/**
 * Archon UI Logger
 *
 * Features:
 * - Env-aware log level via Vite:
 *    - VITE_LOG_LEVEL: "silent" | "error" | "warn" | "info" | "debug"
 *    - Defaults: "debug" in dev, "warn" in production
 * - VITE_ENABLE_VERBOSE_LOGS=true bypasses all filtering
 * - Category support: createLogger('KnowledgeBase') prefixes logs with [Archon][KnowledgeBase]
 * - "[FORCE]" prefix in the first argument always logs (bypass)
 *
 * Works in tandem with the console policy installed in App.tsx
 * so either layer can suppress noisy output in production builds.
 */

type LogLevel = "silent" | "error" | "warn" | "info" | "debug" | "log";

const LEVEL_ORDER: Record<Exclude<LogLevel, "log"> | "log", number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  log: 3,
  debug: 4,
};

const ENV_LEVEL =
  (import.meta.env.VITE_LOG_LEVEL ??
    (import.meta.env.MODE === "production" ? "warn" : "debug")).toLowerCase();

const VERBOSE = import.meta.env.VITE_ENABLE_VERBOSE_LOGS === "true";

// Determine current numeric level with a safe fallback
const CURRENT_LEVEL =
  LEVEL_ORDER[(ENV_LEVEL as LogLevel) in LEVEL_ORDER ? (ENV_LEVEL as LogLevel) : "warn"] ?? 2;

function shouldLog(method: LogLevel, firstArg: unknown): boolean {
  if (VERBOSE) return true;
  if (typeof firstArg === "string" && firstArg.startsWith("[FORCE]")) return true;
  return CURRENT_LEVEL >= LEVEL_ORDER[method];
}

function prefix(category?: string): string {
  return category ? `[Archon][${category}]` : "[Archon]";
}

function emit(method: Exclude<LogLevel, "silent">, category: string | undefined, ...args: any[]) {
  if (!shouldLog(method, args[0])) return;
  // eslint-disable-next-line no-console
  (console as any)[method](prefix(category), ...args);
}

export interface ILogger {
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  info: (...args: any[]) => void;
  log: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  withCategory: (category: string) => ILogger;
}

/**
 * Create a category-specific logger.
 * Usage:
 *   const log = createLogger('ProjectPage');
 *   log.info('Loaded projects', data);
 */
export function createLogger(category?: string): ILogger {
  return {
    error: (...args: any[]) => emit("error", category, ...args),
    warn: (...args: any[]) => emit("warn", category, ...args),
    info: (...args: any[]) => emit("info", category, ...args),
    log: (...args: any[]) => emit("log", category, ...args),
    debug: (...args: any[]) => emit("debug", category, ...args),
    withCategory: (cat: string) => createLogger(cat),
  };
}

/**
 * Global logger without a category.
 * Prefer createLogger('Category') for page or component-level logging.
 */
export const logger: ILogger = createLogger();