#!/usr/bin/env node
// Copy the shipped file set into another repo, pinned to this commit.
//   node scripts/vendor.mjs <dest-dir>
// Writes <dest>/VENDORED.json { name, version, commit, files }. The commit carries "-dirty" when the
// package has uncommitted changes. The destination must be new, empty, or an earlier vendored copy:
// the script replaces it wholesale, so it refuses anything else (a repo root, this package, an ancestor).
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve, relative, isAbsolute, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, staleness } from './build.mjs';

/** Why `out` must not be replaced, or null when it is safe. */
export function refuseDest(out, root = ROOT) {
  const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };
  const o = real(out), r = real(root);
  const rel = relative(o, r);
  if (o === r || (rel && !rel.startsWith('..') && !isAbsolute(rel))) return `${out} is this package or one of its ancestors`;
  const relIn = relative(r, o);
  if (relIn && !relIn.startsWith('..') && !isAbsolute(relIn)) return `${out} is inside this package`;
  if (!existsSync(o)) return null;
  const entries = readdirSync(o);
  if (entries.includes('.git')) return `${out} holds a .git directory (a repository root)`;
  if (entries.length && !entries.includes('VENDORED.json')) return `${out} is not empty and is not an earlier vendored copy (no VENDORED.json)`;
  return null;
}

function main(dest) {
  if (!dest) { console.error('usage: node scripts/vendor.mjs <dest-dir>'); process.exit(2); }
  const out = resolve(dest);
  const why = refuseDest(out);
  if (why) { console.error(`refusing to replace ${out}: ${why}`); process.exit(1); }
  const { stale, extra } = staleness();
  if (stale.length || extra.length) { console.error('dist/ is out of date; run `npm run build` first'); process.exit(1); }
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  let commit = 'unknown';
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (execFileSync('git', ['status', '--porcelain', '--', '.'], { cwd: ROOT, encoding: 'utf8' }).trim()) commit += '-dirty';
  } catch { /* not a git checkout */ }
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const f of pkg.files) if (existsSync(join(ROOT, f))) cpSync(join(ROOT, f), join(out, f), { recursive: true });
  cpSync(join(ROOT, 'package.json'), join(out, 'package.json'));
  writeFileSync(join(out, 'VENDORED.json'), JSON.stringify({ name: pkg.name, version: pkg.version, commit, files: pkg.files }, null, 2) + '\n');
  console.log(`vendored ${pkg.name}@${pkg.version} (${commit.slice(0, 13)}) into ${out}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv[2]);
