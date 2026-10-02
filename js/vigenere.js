// ヴィジュネル暗号の暗号文から、鍵の列ごとの候補と、辞書の語の英語らしさを求める（DOM 非依存）
// 鍵の長さが L なら、暗号文を L 文字ごとに分けた各列は1つのシーザー暗号（同じずらし）になる。
// 列 j で鍵の文字を k と仮定して戻した文字の「英語の出現率の対数」の合計（対数尤度）が大きいほど、k らしい。
// 辞書の語の英語らしさは、各位置の列でその文字を仮定したときの対数尤度の合計（＝その語で全文を戻したときの対数尤度）

import { normalizeLetters } from './loom-core.js';
import { ENGLISH_COUNTS } from './english.js';

const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const MAX_CIPHER_LETTERS = 10000;
export const MAX_PERIOD = 20;
// 列の一致指数の平均がこの値以上の周期を、鍵の長さの候補として先に並べる（Day044 と同じ）
export const KEY_IC_THRESHOLD = 0.058;

const TOTAL = ENGLISH_COUNTS.reduce((a, b) => a + b, 0);
// 出現しない文字があっても対数が -Infinity にならないよう、1を足してから割る
export const ENGLISH_LOG = ENGLISH_COUNTS.map((n) => Math.log((n + 1) / (TOTAL + 26)));
// 英文1文字あたりの対数尤度の期待値（英文そのもの）と、ランダムな文字列のときの値（画面の目安）
export const ENGLISH_EXPECTED = ENGLISH_COUNTS.reduce((s, n, i) => s + (n / TOTAL) * ENGLISH_LOG[i], 0);
export const RANDOM_EXPECTED = ENGLISH_LOG.reduce((s, v) => s + v, 0) / 26;

export function cipherLetters(text) {
  return normalizeLetters(text).letters;
}

export function encryptVigenere(plain, key) {
  let out = '';
  for (let i = 0; i < plain.length; i++) out += A[(plain.charCodeAt(i) - 65 + key.charCodeAt(i % key.length) - 65) % 26];
  return out;
}

export function decryptVigenere(cipher, key) {
  let out = '';
  for (let i = 0; i < cipher.length; i++) out += A[(cipher.charCodeAt(i) - key.charCodeAt(i % key.length) + 26) % 26];
  return out;
}

// 列 j（0 始まり）で鍵の文字を k としたときの対数尤度。戻り値は列ごとの Float64Array(26)
export function columnScores(cipher, L) {
  const out = [];
  for (let j = 0; j < L; j++) {
    const s = new Float64Array(26);
    for (let i = j; i < cipher.length; i += L) {
      const x = cipher.charCodeAt(i) - 65;
      for (let k = 0; k < 26; k++) s[k] += ENGLISH_LOG[(x - k + 26) % 26];
    }
    out.push(s);
  }
  return out;
}

// 列ごとの鍵の文字を、英語らしさの順に並べる。{ letter, score }（score は列の文字1つあたりの対数尤度）
export function rankColumns(cipher, L) {
  return columnScores(cipher, L).map((s, j) => {
    const n = Math.max(1, Math.ceil((cipher.length - j) / L));
    return [...s.keys()].sort((a, b) => s[b] - s[a] || a - b).map((k) => ({ letter: A[k], score: s[k] / n }));
  });
}

// 辞書の語（鍵の長さと同じ文字数）を、その語で暗号文を戻したときの英語らしさの順に並べる。
// score は暗号文1文字あたりの対数尤度（0 に近いほど英語らしい）
export function scoreWordsByCipher(cipher, words, L) {
  if (!cipher.length) return [];
  const scores = columnScores(cipher, L);
  const out = [];
  for (const w of words) {
    if (w.length !== L) continue;
    let s = 0;
    for (let j = 0; j < L; j++) s += scores[j][w.charCodeAt(j) - 65];
    out.push({ word: w, score: s / cipher.length });
  }
  out.sort((a, b) => b.score - a.score || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
  return out;
}

// 周期 k で列に分けたときの、列の一致指数の平均（k＝1〜MAX_PERIOD）
export function periodicIC(cipher, max = MAX_PERIOD) {
  const out = [];
  for (let k = 1; k <= max; k++) {
    let sum = 0;
    let cols = 0;
    for (let j = 0; j < k; j++) {
      const counts = new Array(26).fill(0);
      let n = 0;
      for (let i = j; i < cipher.length; i += k) {
        counts[cipher.charCodeAt(i) - 65] += 1;
        n += 1;
      }
      if (n < 2) continue;
      sum += counts.reduce((a, c) => a + c * (c - 1), 0) / (n * (n - 1));
      cols += 1;
    }
    if (cols) out.push({ k, ic: sum / cols });
  }
  return out;
}

// 鍵の長さの候補: 平均の一致指数が閾値以上の周期を小さい順に、続いて残りを平均の大きい順に（2以上）
export function keyLengthCandidates(cipher, max = MAX_PERIOD) {
  const curve = periodicIC(cipher, max).filter((p) => p.k >= 2);
  const hits = curve.filter((p) => p.ic >= KEY_IC_THRESHOLD).map((p) => p.k);
  const rest = [...curve].sort((a, b) => b.ic - a.ic || a.k - b.k).map((p) => p.k).filter((k) => !hits.includes(k));
  return { candidates: [...hits, ...rest], curve, periodFound: hits.length > 0 };
}
