import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { refuseDest } from '../scripts/vendor.mjs';
import { ROOT, staleness, buildAll } from '../scripts/build.mjs';

test('vendor refuses to replace this package, its ancestors, a repo root or a foreign directory', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'wd-vendor-'));
  try {
    assert.match(refuseDest(ROOT), /this package or one of its ancestors/);
    assert.match(refuseDest(dirname(ROOT)), /ancestors/);
    assert.match(refuseDest(join(ROOT, 'dist')), /inside this package/);
    const repo = join(tmp, 'repo'); mkdirSync(join(repo, '.git'), { recursive: true });
    assert.match(refuseDest(repo), /\.git/);
    const foreign = join(tmp, 'foreign'); mkdirSync(foreign); writeFileSync(join(foreign, 'main.tsx'), '');
    assert.match(refuseDest(foreign), /not an earlier vendored copy/);
    const earlier = join(tmp, 'earlier'); mkdirSync(earlier); writeFileSync(join(earlier, 'VENDORED.json'), '{}');
    assert.equal(refuseDest(earlier), null);
    const empty = join(tmp, 'empty'); mkdirSync(empty);
    assert.equal(refuseDest(empty), null);
    assert.equal(refuseDest(join(tmp, 'new')), null);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('staleness finds generated files no longer produced (build deletes them; vendor refuses)', () => {
  const ghost = join(ROOT, 'dist/icons/__removed-icon.svg');
  writeFileSync(ghost, '<svg/>');
  try {
    const { stale, extra } = staleness(buildAll());
    assert.deepEqual(stale, []);
    assert.deepEqual(extra, ['dist/icons/__removed-icon.svg']);
  } finally { if (existsSync(ghost)) rmSync(ghost); }
  assert.deepEqual(staleness().extra, []);
});
