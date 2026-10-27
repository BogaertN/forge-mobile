#!/usr/bin/env node
/* Offline math-honesty research note. Prints JSON, or markdown with --md.
 * --write <dir> writes math_honesty.json and MATH_HONESTY.md in that directory.
 * This tool is not part of the single-file app. */
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('../research/math_honesty.js');
const args = process.argv.slice(2);
const md = args.includes('--md');
const wi = args.indexOf('--write');
const report = H.run();
const json = JSON.stringify(report, null, 1) + '\n';
const text = H.markdown(report);
if (wi >= 0) {
  const dir = args[wi + 1];
  if (!dir) { process.stderr.write('math_honesty: --write needs a directory\n'); process.exit(2); }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'math_honesty.json'), json);
  fs.writeFileSync(path.join(dir, 'MATH_HONESTY.md'), text);
}
if (md) process.stdout.write(text);
else if (wi < 0) process.stdout.write(json);
