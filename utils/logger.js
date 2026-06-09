// Lightweight, dependency-free logger with configurable levels.
//
// Set the verbosity with the LOG_LEVEL env var (defaults to 'info'):
//   error < warn < info < debug
// A given level prints messages at that level and everything above it, e.g.
// LOG_LEVEL=warn prints warn + error only; LOG_LEVEL=debug prints everything.
// LOG_LEVEL=silent disables all output.

const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

const configured = (process.env.LOG_LEVEL || 'info').toLowerCase();
const threshold = LEVELS[configured] !== undefined ? LEVELS[configured] : LEVELS.info;

const timestamp = () => new Date().toISOString();

const log = (level, consoleFn, ...args) => {
  if (LEVELS[level] <= threshold) {
    consoleFn(`${timestamp()} [${level.toUpperCase()}]`, ...args);
  }
};

module.exports = {
  level: configured,
  error: (...args) => log('error', console.error, ...args),
  warn: (...args) => log('warn', console.warn, ...args),
  info: (...args) => log('info', console.log, ...args),
  debug: (...args) => log('debug', console.log, ...args),
};
