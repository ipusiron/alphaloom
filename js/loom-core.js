// AlphaLoom の探索ロジック（DOM 非依存。画面と node:test の両方から読む）
// 鍵の各位置（列）に「来そうな文字」を優先順に並べると、先頭ほど重い重みを付ける（N 文字なら N, N-1, …, 1 の比）。
// 空欄の列は A〜Z の26文字を同じ重みで扱う。鍵の重みは、各列の重みの積（すべての組み合わせの合計が1になる）

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const MAX_KEY_LENGTH = 20;
export const MAX_KEEP = 50000;
export const DEFAULT_KEEP = 10000;
// 部分一致（鍵の中に辞書の語を含む）で数える語の最小の長さ。1〜2文字の語（A・I・AT など）はほぼすべての鍵に当たるので除く
export const MIN_PARTIAL_WORD = 3;

// 入力を A〜Z の大文字にそろえる。全角英字は NFKC で半角に、アクセント記号は NFD で外す。空白は数えない
export function normalizeLetters(text) {
  const decomposed = String(text ?? '').normalize('NFKC').normalize('NFD');
  let letters = '';
  let ignored = 0;
  for (const ch of decomposed) {
    if (/\p{M}/u.test(ch) || /\s/u.test(ch)) continue;
    const up = ch.toUpperCase();
    if (/^[A-Z]+$/.test(up)) letters += up;
    else ignored += 1;
  }
  return { letters, ignored };
}

// 列の欄の文字列を、重複を除いた候補の並び（優先順）にする。空なら空文字（＝A〜Zすべて）
export function columnLetters(text) {
  let out = '';
  for (const ch of normalizeLetters(text).letters) if (!out.includes(ch)) out += ch;
  return out;
}

// パターン（?HE?? の形）を列の候補の配列にする。? . _ はどの文字でもよい（空欄の列）。英字・? 以外があれば null
export function parsePattern(text) {
  const decomposed = String(text ?? '').normalize('NFKC').normalize('NFD');
  const cols = [];
  for (const ch of decomposed) {
    if (/\p{M}/u.test(ch) || /\s/u.test(ch)) continue;
    if (ch === '?' || ch === '.' || ch === '_') cols.push('');
    else if (/^[A-Z]$/.test(ch.toUpperCase())) cols.push(ch.toUpperCase());
    else return null;
  }
  return cols.length >= 1 && cols.length <= MAX_KEY_LENGTH ? cols : null;
}

// 列の候補（文字列）から、文字・重み（確率）・対数の重みを作る。先頭ほど重い線形の重み、空欄は一様
export function columnModel(letters) {
  const chars = letters ? letters.split('') : ALPHABET.split('');
  const n = chars.length;
  const weights = letters ? chars.map((_, i) => (n - i) / ((n * (n + 1)) / 2)) : chars.map(() => 1 / 26);
  const prob = new Float64Array(26);
  chars.forEach((ch, i) => { prob[ch.charCodeAt(0) - 65] = weights[i]; });
  return { letters: chars.join(''), weights, logw: weights.map(Math.log), prob, any: !letters };
}

export function buildColumns(texts) {
  return texts.map((t) => columnModel(columnLetters(t)));
}

// 組み合わせの総数（BigInt。26の20乗も正確に数える）
export function countCombinations(cols) {
  return cols.reduce((n, c) => n * BigInt(c.letters.length), 1n);
}

// 鍵の重み（各列の重みの積）の対数。どこかの列に入っていない文字があれば null
export function keyLogWeight(cols, key) {
  if (key.length !== cols.length) return null;
  let s = 0;
  for (let i = 0; i < key.length; i++) {
    const p = cols[i].prob[key.charCodeAt(i) - 65];
    if (!(p > 0)) return null;
    s += Math.log(p);
  }
  return s;
}

const EPS = 1e-12;

// 重みの大きい組み合わせから順に、ちょうど keep 件（総数がそれより少なければ全部）を返す。近似ではなく正確な上位。
// 各列の候補は重みの大きい順に並んでいるので、「各列で何番目の文字を使うか」の組（位置の組）を、優先度つきキューで
// 重みの大きいものから取り出し、取り出した組の各列を1つずつ次の文字に進めた組をキューへ足す（同じ組は1回だけ）。
// 重みが等しいときは鍵の ABC 順。戻り値の各要素: { key, logw }（logw＝重みの積の対数）
export function topCombinations(cols, keep) {
  const L = cols.length;
  if (!L || keep < 1) return [];
  const total = countCombinations(cols);
  const want = total < BigInt(keep) ? Number(total) : keep;
  const heap = [];
  const seen = new Set();
  const keyOf = (idx) => idx.map((k, i) => cols[i].letters[k]).join('');
  const better = (a, b) => (a.logw > b.logw + EPS) || (Math.abs(a.logw - b.logw) <= EPS && a.key < b.key);
  const push = (node) => {
    heap.push(node);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!better(heap[i], heap[p])) break;
      [heap[i], heap[p]] = [heap[p], heap[i]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && better(heap[l], heap[m])) m = l;
        if (r < heap.length && better(heap[r], heap[m])) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m], heap[i]];
        i = m;
      }
    }
    return top;
  };
  const start = new Array(L).fill(0);
  push({ idx: start, key: keyOf(start), logw: cols.reduce((s, c) => s + c.logw[0], 0) });
  seen.add(start.join(','));
  const out = [];
  while (out.length < want && heap.length) {
    const node = pop();
    out.push({ key: node.key, logw: node.logw });
    for (let i = 0; i < L; i++) {
      const k = node.idx[i] + 1;
      if (k >= cols[i].letters.length) continue;
      const idx = node.idx.slice();
      idx[i] = k;
      const id = idx.join(',');
      if (seen.has(id)) continue;
      seen.add(id);
      push({ idx, key: keyOf(idx), logw: node.logw - cols[i].logw[k - 1] + cols[i].logw[k] });
    }
  }
  return out;
}

// 辞書の語を、列の候補で採点する（同じ長さで、どの位置の文字も列の候補に入っている語だけ）。重みの大きい順
// 生成した組み合わせの範囲に縛られないので、上位に入らない語も取りこぼさない
export function scoreDictionary(cols, words) {
  const out = [];
  for (const w of words) {
    if (w.length !== cols.length) continue;
    const logw = keyLogWeight(cols, w);
    if (logw !== null) out.push({ word: w, logw });
  }
  out.sort((a, b) => b.logw - a.logw || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
  return out;
}

// 鍵の中に含まれる辞書の語（MIN_PARTIAL_WORD 文字以上）。長い語を優先し、重ならない位置だけを返す（ハイライト用）
// 辞書をなめず、鍵の部分文字列（20文字なら171通り）を辞書の Set で引く
export function findWordsInKey(key, wordSet, minLen = MIN_PARTIAL_WORD) {
  const found = [];
  for (let len = key.length; len >= minLen; len--) {
    for (let i = 0; i + len <= key.length; i++) {
      const sub = key.slice(i, i + len);
      if (!wordSet.has(sub)) continue;
      if (found.some((f) => i < f.end && i + len > f.start)) continue;
      found.push({ start: i, end: i + len, word: sub });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

// 辞書ファイルの本文を語の一覧にする（1行に1語、英字だけに直して重複を除く）
export function parseWordList(text) {
  const seen = new Set();
  let lines = 0;
  let invalid = 0;
  let duplicates = 0;
  for (const raw of String(text ?? '').split(/\r\n|\n|\r/)) {
    const line = raw.trim();
    if (!line) continue;
    lines += 1;
    const { letters } = normalizeLetters(line);
    if (!letters) invalid += 1;
    else if (seen.has(letters)) duplicates += 1;
    else seen.add(letters);
  }
  return { words: [...seen], lines, invalid, duplicates };
}

// 重み（確率）を百分率の文字列にする。小さい値は有効数字3桁の指数表記
export function formatShare(logw) {
  const pct = Math.exp(logw) * 100;
  if (pct >= 0.01) return `${Number(pct.toPrecision(3))}%`;
  return `${pct.toExponential(2)}%`;
}

// 書き出し用。CSV は Excel で文字化けしないよう BOM つき・CRLF、すべての欄を引用符で囲む
export function toCsv(header, rows) {
  const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
  return '\uFEFF' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
