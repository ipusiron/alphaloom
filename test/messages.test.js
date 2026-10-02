import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MESSAGES, t, setLanguage, getLanguage } from '../js/messages.js';
import { BUNDLED_WORDLISTS } from '../js/wordlists.js';

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const LOGIC = ['script.js', 'js/loom-core.js', 'js/wordlists.js', 'js/tabs.js', 'js/theme.js'];
// かな・カタカナ・漢字（記号の定数はエスケープ表記で書くので、ここに当たるのは文言だけ）
const JAPANESE = new RegExp('[\\u3040-\\u30ff\\u3400-\\u9fff]');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

test('画面の文言は messages.js に集め、ほかの JS のコード（コメント以外）に日本語を書かない', () => {
  for (const f of LOGIC) {
    const lines = stripComments(read(f)).split('\n');
    const hit = lines.findIndex((l) => JAPANESE.test(l));
    assert.equal(hit, -1, `${f}:${hit + 1} ${lines[hit]}`);
  }
});

test('script.js が使うキーは、すべて日本語の辞書にある', () => {
  const src = read('script.js');
  const keys = new Set([...src.matchAll(/\bt\('([\w.]+)'/g)].map((m) => m[1]));
  // テンプレートで組み立てるキー
  for (const k of ['Builtin', 'Bundled', 'File', 'Paste']) keys.add(`dictionary.kind${k}`);
  for (const w of BUNDLED_WORDLISTS) keys.add(`dictionary.bundled.${w.id}`);
  for (const k of keys) assert.ok(k in MESSAGES.ja, k);
  assert.ok(keys.size > 30);
});

test('置き場所 {name} を値で埋める。未知のキーはキーのまま、英語にない文言は日本語を使う', () => {
  assert.equal(t('dictionary.words', { n: '1,234' }), '1,234 語');
  assert.equal(t('no.such.key'), 'no.such.key');
  assert.equal(getLanguage(), 'ja');
  assert.equal(setLanguage('xx'), 'ja');
  assert.equal(t('dictionary.words', { n: 5 }, 'en'), MESSAGES.en['dictionary.words'] ? t('dictionary.words', { n: 5 }, 'en') : '5 語');
});
