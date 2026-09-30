/**
 * Back up the app database with pg_dump (custom format), using the DB_* values
 * from .env without printing them.
 *
 * Usage: node scripts/db-backup.js [output-dir]     (default: ./backups)
 * Restore (only if needed): pg_restore --clean --if-exists -d <db> <file>
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const db = require('../config/db.config');

const outDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'backups'));
fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const file = path.join(outDir, `${db.DB}-${stamp}.dump`);

const child = spawn('pg_dump', ['-h', db.HOST, '-p', String(db.PORT), '-U', db.USER, '-Fc', '-f', file, db.DB], {
  env: { ...process.env, PGPASSWORD: db.PASSWORD },
  stdio: ['ignore', 'inherit', 'inherit']
});
child.on('error', (err) => { console.error('✗ could not run pg_dump:', err.message); process.exit(1); });
child.on('exit', (code) => {
  if (code !== 0) { console.error(`✗ pg_dump failed (exit ${code})`); process.exit(code || 1); }
  fs.chmodSync(file, 0o600);
  console.log(`✓ backup written: ${file} (${fs.statSync(file).size} bytes)`);
});
