'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(c?js)$/.test(file)) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (result.status) { process.stderr.write(result.stderr); process.exit(1); }
    }
  }
}
walk(path.resolve(__dirname, '../src/payload'));
require('./check-provenance.cjs');
console.log('All payload JavaScript parses successfully.');
