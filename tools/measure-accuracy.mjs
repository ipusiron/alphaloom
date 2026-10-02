// 鍵が英単語のヴィジュネル暗号で、暗号文の長さごとに「鍵がどれだけ当たるか」を測り、js/accuracy.js に書き出す
// 使い方: node tools/measure-accuracy.mjs（大きい辞書を含めて30秒ほど）
// 評価の英文: Project Gutenberg #98 A Tale of Two Cities の抜粋（tools/corpus/eval-pg98.txt。英語の文字の出現数には使っていない）
// 鍵: english_5067・english_1842 の語から、長さ4〜8を同じ回数ずつ選ぶ。抜粋の位置と鍵は決まった種の乱数で選ぶ（何度回しても同じ結果）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWordList } from '../js/loom-core.js';
import { BUILTIN_WORDS, BUNDLED_WORDLISTS, DEFAULT_WORDLISTS } from '../js/wordlists.js';
import { encryptVigenere, rankColumns, scoreWordsByCipher } from '../js/vigenere.js';
import { readCorpus } from './build-english.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LENGTHS = [24, 40, 60, 100, 160];
export const KEY_LENGTHS = [4, 5, 6, 7, 8];
export const TRIALS = 300;
export const SEED = 20261003;

const words = (file) => parseWordList(fs.readFileSync(path.join(ROOT, file), 'utf8')).words;

export function dictionaries() {
  const byId = Object.fromEntries(BUNDLED_WORDLISTS.map((w) => [w.id, w]));
  const base = [...new Set([...BUILTIN_WORDS, ...DEFAULT_WORDLISTS.flatMap((id) => words(byId[id].file))])];
  const large = [...new Set([...base, ...words(byId.twelvedicts.file)])];
  const keys = [...new Set(['english_5067', 'english_1842'].flatMap((id) => words(byId[id].file)))];
  return { base, large, keys };
}

// xorshift32（決まった種で同じ並びを出す）
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function measure(dict, keys, evalText, lengths = LENGTHS, trials = TRIALS, seed = SEED) {
  const byLen = (list, L) => list.filter((w) => w.length === L);
  const out = [];
  for (const n of lengths) {
    const row = { length: n, trials: 0, perColumn: 0, rank1: 0, top5: 0 };
    for (const L of KEY_LENGTHS) {
      const r = rng(seed + n * 100 + L);
      const pool = byLen(keys, L);
      const cands = byLen(dict, L);
      for (let t = 0; t < trials; t++) {
        const key = pool[Math.floor(r() * pool.length)];
        const start = Math.floor(r() * (evalText.length - n));
        const c = encryptVigenere(evalText.slice(start, start + n), key);
        if (rankColumns(c, L).every((col, j) => col[0].letter === key[j])) row.perColumn += 1;
        const ranked = scoreWordsByCipher(c, cands, L);
        const pos = ranked.findIndex((x) => x.word === key);
        if (pos === 0) row.rank1 += 1;
        if (pos >= 0 && pos < 5) row.top5 += 1;
        row.trials += 1;
      }
    }
    out.push(row);
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const evalText = readCorpus('eval-pg98.txt');
  const { base, large, keys } = dictionaries();
  const result = { base: { words: base.length, rows: measure(base, keys, evalText) }, large: { words: large.length, rows: measure(large, keys, evalText) } };
  const lines = [
    '// 自動生成（tools/measure-accuracy.mjs）。手で書き換えない',
    '// 鍵が英単語（english_5067・english_1842 の語、長さ4〜8）のヴィジュネル暗号で、暗号文の長さごとに鍵が当たった回数',
    '// perColumn＝列ごとの1位をつないだ鍵が正解、rank1／top5＝辞書の語を英語らしさで並べた1位／上位5位に正解',
    '// base＝最初から使う辞書（内蔵＋english_5067＋english_1842）、large＝それに大きい英単語辞書（12dicts）を足したもの',
    `// 評価の英文: tools/corpus/eval-pg98.txt、各長さで鍵の長さ4〜8を${TRIALS}回ずつ（種 ${SEED}）`,
    `export const ACCURACY = ${JSON.stringify(result, null, 2).replace(/"(\w+)":/g, '$1:').replace(/"/g, "'")};`,
    ''
  ];
  fs.writeFileSync(path.join(ROOT, 'js', 'accuracy.js'), lines.join('\n'));
  for (const [name, r] of Object.entries(result)) {
    console.log(name, r.words);
    for (const row of r.rows) {
      const pct = (x) => `${Math.round((x / row.trials) * 100)}%`;
      console.log(` ${row.length}字: 列ごとの1位 ${pct(row.perColumn)} / 辞書の1位 ${pct(row.rank1)} / 上位5位 ${pct(row.top5)}`);
    }
  }
}
