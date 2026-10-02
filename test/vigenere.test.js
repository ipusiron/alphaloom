import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptVigenere, decryptVigenere, rankColumns, scoreWordsByCipher, keyLengthCandidates, periodicIC, cipherLetters,
  ENGLISH_EXPECTED, RANDOM_EXPECTED
} from '../js/vigenere.js';
import { ENGLISH_COUNTS } from '../js/english.js';
import { ACCURACY } from '../js/accuracy.js';
import { letterCounts, readCorpus } from '../tools/build-english.mjs';
import { dictionaries, measure, LENGTHS, TRIALS, KEY_LENGTHS } from '../tools/measure-accuracy.mjs';

const evalText = readCorpus('eval-pg98.txt');
const { base, keys } = dictionaries();
export const EXAMPLE = { key: 'GARDEN', plain: evalText.slice(0, 40) };

test('既知解答: ATTACKATDAWN を鍵 LEMON で暗号化すると LXFOPVEFRNHR（Wikipedia の例）。戻すと元に戻る', () => {
  assert.equal(encryptVigenere('ATTACKATDAWN', 'LEMON'), 'LXFOPVEFRNHR');
  assert.equal(decryptVigenere('LXFOPVEFRNHR', 'LEMON'), 'ATTACKATDAWN');
  const p = evalText.slice(500, 800);
  for (const key of ['A', 'Z', 'KEY', 'CRYPTOGRAPHY']) assert.equal(decryptVigenere(encryptVigenere(p, key), key), p, key);
  assert.equal(cipherLetters('lxf opv-ef！'), 'LXFOPVEF');
});

test('英語の文字の出現数は、学習用の英文から数えた値（js/english.js は tools/build-english.mjs が作る）', () => {
  assert.deepEqual(ENGLISH_COUNTS, letterCounts(readCorpus('train-pg1342.txt')));
  assert.ok(ENGLISH_EXPECTED > RANDOM_EXPECTED);
  assert.equal(ENGLISH_EXPECTED.toFixed(2), '-2.90');
  assert.equal(RANDOM_EXPECTED.toFixed(2), '-3.83');
});

test('300字なら、鍵の長さの推定の1位が5（鍵 LEMON）で、列ごとの1位をつなぐと LEMON', () => {
  const c = encryptVigenere(evalText.slice(1000, 1300), 'LEMON');
  const kl = keyLengthCandidates(c);
  assert.equal(kl.candidates[0], 5);
  assert.ok(kl.periodFound);
  assert.equal(periodicIC(c).length, 20);
  assert.equal(rankColumns(c, 5).map((col) => col[0].letter).join(''), 'LEMON');
  assert.equal(scoreWordsByCipher(c, base, 5)[0].word, 'LEMON');
});

test('README の例: 40字・鍵 GARDEN では、列ごとの1位は UAROEN だが、辞書の語の1位は GARDEN', () => {
  const c = encryptVigenere(EXAMPLE.plain, EXAMPLE.key);
  assert.equal(EXAMPLE.plain, 'ORMEHEREIWASHAPPYSAIDMRLORRYTOBEENTRUSTE');
  assert.equal(c, 'URDHLRXEZZEFNAGSCFGIUPVYURIBXBHEVQXEASKH');
  assert.equal(rankColumns(c, 6).map((col) => col[0].letter).join(''), 'UAROEN');
  assert.deepEqual(scoreWordsByCipher(c, base, 6).slice(0, 3).map((x) => x.word), ['GARDEN', 'CARPET', 'CAREER']);
  assert.equal(decryptVigenere(c, 'GARDEN'), EXAMPLE.plain);
});

test('辞書の語の採点: 鍵の長さと同じ文字数の語だけを、英語らしさ（1文字あたりの対数尤度）の大きい順に', () => {
  const c = encryptVigenere(evalText.slice(0, 60), 'KEY');
  const r = scoreWordsByCipher(c, ['KEY', 'KEYS', 'AAA', 'ZZZ'], 3);
  assert.deepEqual(r.map((x) => x.word).sort(), ['AAA', 'KEY', 'ZZZ']);
  assert.equal(r[0].word, 'KEY');
  assert.ok(r.every((x, i) => i === 0 || x.score <= r[i - 1].score));
  assert.deepEqual(scoreWordsByCipher('', ['KEY'], 3), []);
});

test('正答率の表（js/accuracy.js）は、測定の道具を回し直した値と一致する（最初から使う辞書・24字）', () => {
  assert.deepEqual(ACCURACY.base.rows.map((r) => r.length), LENGTHS);
  assert.equal(ACCURACY.base.words, base.length);
  for (const r of [...ACCURACY.base.rows, ...ACCURACY.large.rows]) assert.equal(r.trials, TRIALS * KEY_LENGTHS.length);
  const again = measure(base, keys, evalText, [24]);
  assert.deepEqual(again[0], ACCURACY.base.rows[0]);
  // 大きい辞書を足すと、短い暗号文では1位の割合が下がる（誤答の候補が増える）
  assert.ok(ACCURACY.large.rows[0].rank1 < ACCURACY.base.rows[0].rank1);
});
