// File logging for environments where stdout/stderr isn't visible.
//
// Hostinger's Node.js hosting runs the app under Phusion Passenger, which does
// NOT surface console output in any panel — so console.log/console.error appear
// to vanish. This module tees every console call to a plain text file you can
// open in hPanel → File Manager, while still writing to the real stdout/stderr.
//
// Require this as the VERY FIRST line of server.js so it captures everything,
// including boot logs and migration output.
//
// View the log:  hPanel → File Manager → <app folder>/logs/app.log
// Disable:       set LOG_TO_FILE=false in the Node.js app's environment vars.
// Location:      override with LOG_FILE=/absolute/path.log

const fs = require('fs');
const path = require('path');

if (String(process.env.LOG_TO_FILE || 'true').toLowerCase() !== 'false') {
  try {
    const logFile = process.env.LOG_FILE || path.join(__dirname, '..', 'logs', 'app.log');
    fs.mkdirSync(path.dirname(logFile), { recursive: true });

    // Rotate once the file gets large so it never fills the disk quota.
    const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
    try {
      const { size } = fs.statSync(logFile);
      if (size > MAX_BYTES) fs.renameSync(logFile, `${logFile}.1`); // keep one previous file
    } catch { /* file doesn't exist yet — fine */ }

    const stream = fs.createWriteStream(logFile, { flags: 'a' });
    const stamp = () => new Date().toISOString();

    const format = (args) =>
      args
        .map((a) => {
          if (typeof a === 'string') return a;
          if (a instanceof Error) return a.stack || a.message;
          try { return JSON.stringify(a); } catch { return String(a); }
        })
        .join(' ');

    const tee = (level, original) =>
      (...args) => {
        try { stream.write(`${stamp()} [${level}] ${format(args)}\n`); } catch { /* never let logging crash the app */ }
        original.apply(console, args);
      };

    console.log   = tee('LOG',   console.log);
    console.info  = tee('INFO',  console.info);
    console.warn  = tee('WARN',  console.warn);
    console.error = tee('ERROR', console.error);
    console.debug = tee('DEBUG', console.debug);

    // Last-resort capture: a crash that bypasses Express still lands in the file.
    process.on('uncaughtException',  (err) => console.error('[uncaughtException]', err));
    process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

    console.log(`File logging enabled → ${logFile}`);
  } catch (err) {
    // If file logging can't initialize, carry on with plain console.
    console.error('File logging init failed:', err.message);
  }
}
