#!/usr/bin/env node
// Copy the publishable file set into another repo, pinned to this commit.
//   node scripts/vendor.mjs <dest-dir>
// Writes <dest>/VENDORED.json { name, version, commit, files } so the consumer can see what it holds.
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, buildAll } from './build.mjs';

const dest = process.argv[2];
if (!dest) { console.error('usage: node scripts/vendor.mjs <dest-dir>'); process.exit(2); }
const stale = Object.entries(buildAll()).filter(([p, c]) => !existsSync(join(ROOT, p)) || readFileSync(join(ROOT, p), 'utf8') !== c);
if (stale.length) { console.error('dist/ is stale; run `npm run build` first'); process.exit(1); }
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
let commit = 'unknown';
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { /* not a git checkout */ }
const out = resolve(dest);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of pkg.files) if (existsSync(join(ROOT, f))) cpSync(join(ROOT, f), join(out, f), { recursive: true });
cpSync(join(ROOT, 'package.json'), join(out, 'package.json'));
writeFileSync(join(out, 'VENDORED.json'), JSON.stringify({ name: pkg.name, version: pkg.version, commit, files: pkg.files }, null, 2) + '\n');
console.log(`vendored ${pkg.name}@${pkg.version} (${commit.slice(0, 7)}) into ${out}`);
