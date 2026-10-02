import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseWordList } from '../js/loom-core.js';
import { BUILTIN_WORDS, BUILTIN_FILE, BUNDLED_WORDLISTS, DEFAULT_WORDLISTS, bundledById, displayName, MAX_NAME_LENGTH } from '../js/wordlists.js';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('付属辞書の行数と語数（正規化して重複を除いたあと）が一覧の値と一致する', () => {
  for (const w of BUNDLED_WORDLISTS) {
    const r = parseWordList(read(w.file));
    assert.equal(r.lines, w.lines, `${w.id} lines`);
    assert.equal(r.words.length, w.words, `${w.id} words`);
  }
  for (const id of DEFAULT_WORDLISTS) assert.ok(bundledById(id), id);
  assert.equal(bundledById('nothing'), null);
  // wordlists/ の .txt は、一覧か内蔵ミニ辞書のファイルのどちらか
  const files = fs.readdirSync(new URL('../wordlists/', import.meta.url)).filter((f) => f.endsWith('.txt')).map((f) => `wordlists/${f}`).sort();
  assert.deepEqual([...BUNDLED_WORDLISTS.map((w) => w.file), BUILTIN_FILE].sort(), files);
});

test('内蔵ミニ辞書は222語（重複なし）で、english-mini-223.txt の語と同じ（ファイルは ABOUT が2行で223行）', () => {
  assert.equal(BUILTIN_WORDS.length, 222);
  assert.equal(new Set(BUILTIN_WORDS).size, 222);
  const r = parseWordList(read(BUILTIN_FILE));
  assert.equal(r.lines, 223);
  assert.equal(r.duplicates, 1);
  assert.deepEqual(r.words, BUILTIN_WORDS);
});

test('辞書名: 制御文字を空白に、長すぎる名前は切る', () => {
  assert.equal(displayName('my\tlist.txt'), 'my list.txt');
  assert.equal(displayName('<img src=x onerror=alert(1)>.txt'), '<img src=x onerror=alert(1)>.txt');
  assert.equal(displayName('a'.repeat(200)).length, MAX_NAME_LENGTH);
});

test('12dicts 3of6game: 改行を LF にそろえた内容の SHA-256 が出典の記載と一致し、出典の文書がある。最初からは読み込まない', async () => {
  const { createHash } = await import('node:crypto');
  const text = read('wordlists/12dicts-3of6game.txt').replace(/\r\n/g, '\n');
  const hash = createHash('sha256').update(text, 'utf8').digest('hex');
  const notice = read('wordlists/12dicts-NOTICE.md');
  assert.equal(hash, 'aecd303c276568591a7cb788c2c27fd412151430541b82237bd0cd3693a7d9c6');
  assert.ok(notice.includes(hash));
  assert.ok(notice.includes('public domain'));
  assert.ok(!DEFAULT_WORDLISTS.includes('twelvedicts'));
});
