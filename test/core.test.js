import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLetters, columnLetters, parsePattern, columnModel, buildColumns, countCombinations, keyLogWeight, topCombinations,
  scoreDictionary, findWordsInKey, parseWordList, formatShare, toCsv, MAX_KEY_LENGTH
} from '../js/loom-core.js';
import { BUILTIN_WORDS } from '../js/wordlists.js';

const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// 総当たり: すべての組み合わせを重みの大きい順（同じなら ABC 順）に並べる
function brute(cols) {
  let keys = [''];
  for (const c of cols) keys = keys.flatMap((k) => c.letters.split('').map((ch) => k + ch));
  return keys.map((key) => ({ key, logw: keyLogWeight(cols, key) }))
    .sort((a, b) => (b.logw - a.logw > 1e-12 ? 1 : a.logw - b.logw > 1e-12 ? -1 : a.key < b.key ? -1 : 1));
}

test('正規化: 英字だけを大文字に。全角英字・アクセント記号も受け付ける', () => {
  assert.deepEqual(normalizeLetters('cab'), { letters: 'CAB', ignored: 0 });
  assert.deepEqual(normalizeLetters('ＣＡＢ'), { letters: 'CAB', ignored: 0 });
  assert.deepEqual(normalizeLetters('é 1!'), { letters: 'E', ignored: 2 });
  assert.equal(columnLetters('cabca'), 'CAB');
  assert.equal(columnLetters('ｔｈｓ'), 'THS');
  assert.equal(columnLetters(''), '');
});

test('パターン: 英字はその文字、? . _ は空欄の列。英字・? 以外や21文字以上は null', () => {
  assert.deepEqual(parsePattern('?he??'), ['', 'H', 'E', '', '']);
  assert.deepEqual(parsePattern('ＴＨ？'), ['T', 'H', '']);
  assert.deepEqual(parsePattern('A._ B'), ['A', '', '', 'B']);
  assert.equal(parsePattern('A-B'), null);
  assert.equal(parsePattern(''), null);
  assert.equal(parsePattern('?'.repeat(MAX_KEY_LENGTH + 1)), null);
  assert.equal(parsePattern('?'.repeat(MAX_KEY_LENGTH)).length, MAX_KEY_LENGTH);
});

test('列の重み: 先頭ほど重い線形の重み（CAB なら 3:2:1）、空欄は26文字が同じ重み。どの列も合計1', () => {
  const c = columnModel('CAB');
  assert.deepEqual(c.weights.map((w) => +w.toFixed(4)), [0.5, 0.3333, 0.1667]);
  assert.equal(c.prob[2], 0.5);
  assert.equal(c.prob[25], 0);
  const any = columnModel('');
  assert.equal(any.letters, A);
  assert.ok(any.any);
  for (const col of [c, any, columnModel('X')]) assert.ok(Math.abs(col.weights.reduce((s, w) => s + w, 0) - 1) < 1e-12);
});

test('組み合わせの総数は BigInt で正確に数える（空欄20列＝26の20乗）', () => {
  assert.equal(countCombinations(buildColumns(['THS', 'HEA', 'EAI', '', 'RYS'])), 2106n);
  assert.equal(countCombinations(buildColumns(Array(20).fill(''))), 26n ** 20n);
});

test('上位の組み合わせは、総当たりで並べた上位とかならず一致する（ランダムな300通り）', () => {
  let seed = 7;
  const r = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let t = 0; t < 300; t++) {
    const L = 1 + Math.floor(r() * 4);
    const texts = Array.from({ length: L }, () => {
      if (r() < 0.25) return '';
      let s = '';
      const n = 1 + Math.floor(r() * 5);
      while (s.length < n) { const ch = A[Math.floor(r() * 26)]; if (!s.includes(ch)) s += ch; }
      return s;
    });
    const cols = buildColumns(texts);
    const keep = 1 + Math.floor(r() * 400);
    assert.deepEqual(topCombinations(cols, keep).map((x) => x.key), brute(cols).slice(0, keep).map((x) => x.key), JSON.stringify(texts));
  }
});

test('鍵はかならず指定の長さ。空欄20列でも上位を返し、総数より多くは返さない', () => {
  const r = topCombinations(buildColumns(Array(20).fill('')), 50);
  assert.equal(r.length, 50);
  assert.ok(r.every((x) => x.key.length === 20));
  assert.equal(r[0].key, 'A'.repeat(20));
  assert.equal(topCombinations(buildColumns(['AB', 'C']), 100).length, 2);
  assert.deepEqual(topCombinations(buildColumns(['AB', 'C']), 100).map((x) => x.key), ['AC', 'BC']);
  assert.deepEqual(topCombinations(buildColumns([]), 10), []);
});

test('README の例（THS・HEA・EAI・空欄・RYS）: 2,106通り、THESE は作れず、THEIR は重み0.24%で辞書の1位', () => {
  const cols = buildColumns(['THS', 'HEA', 'EAI', '', 'RYS']);
  assert.equal(keyLogWeight(cols, 'THESE'), null);
  assert.equal(formatShare(keyLogWeight(cols, 'THEIR')), '0.24%');
  const top = topCombinations(cols, 3);
  assert.deepEqual(top.map((x) => x.key), ['THEAR', 'THEBR', 'THECR']);
  const dict = scoreDictionary(cols, BUILTIN_WORDS);
  assert.deepEqual(dict.map((x) => x.word), ['THEIR']);
});

test('辞書の採点: 同じ長さで、どの位置の文字も列の候補に入っている語だけを、重みの大きい順に', () => {
  const cols = buildColumns(['LT', 'E', 'M', 'O', 'NA']);
  const r = scoreDictionary(cols, ['LEMON', 'TEMON', 'LEMOA', 'MELON', 'LEMONS', 'LEMONA']);
  assert.deepEqual(r.map((x) => x.word), ['LEMON', 'LEMOA', 'TEMON']);
  const weights = r.map((x) => x.logw);
  assert.ok(weights[0] > weights[2]);
  assert.equal(Math.abs(weights[1] - weights[2]) < 1e-12, true);
});

test('鍵の中の辞書の語: 3文字以上、長い語を優先し、重ならない位置だけ', () => {
  const set = new Set(['THE', 'KEY', 'HE', 'EKE', 'THEKEY', 'KEYS']);
  assert.deepEqual(findWordsInKey('THEKEYX', set), [{ start: 0, end: 6, word: 'THEKEY' }]);
  assert.deepEqual(findWordsInKey('XTHEXKEY', set).map((f) => f.word), ['THE', 'KEY']);
  assert.deepEqual(findWordsInKey('AHEB', set), []);
});

test('辞書ファイルの読み込み: 1行1語、英字だけに直して重複を除く', () => {
  const r = parseWordList('the\r\nTHE\n\n  key  \nA-B\n123\n');
  assert.deepEqual(r.words, ['THE', 'KEY', 'AB']);
  assert.equal(r.lines, 5);
  assert.equal(r.duplicates, 1);
  assert.equal(r.invalid, 1);
});

test('重みの表示と CSV', () => {
  assert.equal(formatShare(Math.log(0.5)), '50%');
  assert.equal(formatShare(Math.log(1 / 26 ** 5)), '8.42e-6%');
  const csv = toCsv(['rank', 'key'], [[1, 'THEIR'], [2, 'say "hi"']]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.equal(csv.slice(1), '"rank","key"\r\n"1","THEIR"\r\n"2","say ""hi"""\r\n');
});
