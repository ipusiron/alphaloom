import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// 1行に詰め込んだ（minify した）ファイルと、シェル経由の置換で紛れ込んだ制御文字を検出する
const ROOT = new URL('..', import.meta.url);
const files = (dir, ext) => fs.readdirSync(new URL(dir, ROOT)).filter((f) => f.endsWith(ext)).map((f) => `${dir}${f}`);
const lines = (f) => fs.readFileSync(new URL(f, ROOT), 'utf8').split(/\r?\n/);
const CODE = () => [...files('js/', '.js'), ...files('test/', '.js'), ...files('tools/', '.mjs'), 'script.js', 'style.css'];

test('JS・CSS・テストの最長行は160文字以下、index.html は250文字以下', () => {
  for (const f of CODE()) {
    const long = lines(f).findIndex((l) => l.length > 160);
    assert.equal(long, -1, `${f}:${long + 1}`);
  }
  assert.equal(lines('index.html').findIndex((l) => l.length > 250), -1);
});

test('JS・CSS・HTML に制御文字（タブ・改行以外）が入っていない', () => {
  for (const f of [...CODE(), 'index.html']) {
    const text = fs.readFileSync(new URL(f, ROOT), 'utf8');
    const bad = [...text].findIndex((c) => c.charCodeAt(0) < 32 && ![9, 10, 13].includes(c.charCodeAt(0)));
    assert.equal(bad, -1, f);
    // BOM などの不可視文字を生で書かない（必要ならエスケープで書く）
    assert.ok(!text.includes(String.fromCharCode(0xfeff)), f);
  }
});

test('主要ファイルの行数の下限（詰め込み・取り違えの検出）', () => {
  const min = { 'index.html': 150, 'style.css': 300, 'script.js': 300, 'js/loom-core.js': 150 };
  for (const [f, n] of Object.entries(min)) assert.ok(lines(f).length >= n, `${f}: ${lines(f).length}`);
});
