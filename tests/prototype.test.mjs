import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const html = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('prototype includes semantic landmarks and an accessible alternate view', () => {
  for (const marker of ['<main ', '<aside ', '<header>', '<footer ', 'aria-label="Exploration view"', 'id="listView"', 'id="mapView"', 'id="search"']) {
    assert.ok(html.includes(marker), 'Missing ' + marker);
  }
});

test('inline JavaScript parses without requiring external dependencies', () => {
  assert.ok(script, 'Inline application script is required');
  assert.doesNotThrow(() => new vm.Script(script));
  assert.doesNotMatch(html, /<script[^>]+src=/i);
});

test('example constellations are complete and marked as illustrative', () => {
  const ids = ['origin', 'elle', 'architecture', 'human', 'creative', 'discoveries', 'possibilities', 'infinite'];
  for (const id of ids) assert.ok(script.includes('id:"' + id + '"'), 'Missing ' + id);
  assert.match(html, /illustrative placeholders, not verified milestones/);
});

test('UI retains safe dynamic text and keyboard accessibility conventions', () => {
  assert.doesNotMatch(script, /innerHTML|document\.write\s*\(/);
  assert.match(script, /document\.createElement\("button"\)/);
  assert.match(script, /target\.focus\(\)/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /:focus-visible/);
});

test('search, filtering and display modes remain wired', () => {
  assert.match(script, /search\.addEventListener\("input",draw\)/);
  assert.match(script, /button\.dataset\.filter/);
  assert.match(script, /setMode\("map"\)/);
  assert.match(script, /setMode\("list"\)/);
});
