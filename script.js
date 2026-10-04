// AlphaLoom - by ipusiron
// MIT License
// 画面の処理（ES module）。探索のロジックは js/loom-core.js、辞書の一覧は js/wordlists.js、文言は js/messages.js

import {
  columnLetters, parsePattern, buildColumns, countCombinations, topCombinations, scoreDictionary, findWordsInKey, parseWordList,
  normalizeLetters, formatShare, toCsv, MAX_KEY_LENGTH, MAX_KEEP, DEFAULT_KEEP, MIN_PARTIAL_WORD
} from './js/loom-core.js';
import { BUILTIN_WORDS, BUNDLED_WORDLISTS, DEFAULT_WORDLISTS, MAX_FILE_BYTES, MAX_DICTIONARY_WORDS, displayName } from './js/wordlists.js';
import { t } from './js/messages.js';
import { initThemeToggle, refreshThemeButton } from './js/theme.js';
import { initialLanguage, saveLanguage, useLanguage } from './js/i18n.js';
import { initTabs } from './js/tabs.js';
import {
  cipherLetters, rankColumns, scoreWordsByCipher, decryptVigenere, keyLengthCandidates, MAX_CIPHER_LETTERS, ENGLISH_EXPECTED, RANDOM_EXPECTED
} from './js/vigenere.js';
import { ACCURACY } from './js/accuracy.js';
import { readParams, urlWithoutHandoff } from './js/params.js';

// ===== Utilities =====
const $ = (sel) => document.querySelector(sel);
const fmt = (n) => Number(n).toLocaleString();
const IS_FILE = window.location.protocol === 'file:';
const PAGE = 200;
// 試し解きで表に出す、戻した文の先頭の文字数
const PREVIEW = 40;
// 書き出しに入れる、戻した文の先頭の文字数（辞書の語の数×暗号文の長さで大きくなりすぎないように）
const EXPORT_PREVIEW = 100;
// 暗号文での照合の表に出す語の数（全件は書き出しで）
const CIPHER_ROWS = 50;
const TOOL_BASE = 'https://ipusiron.github.io/';

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

function setStatus(node, text, isError = false) {
  node.textContent = text;
  node.classList.toggle('error', isError);
}

// ===== Columns =====
function columnInputs() {
  return [...$('#columnsContainer').querySelectorAll('input')];
}

// 列の欄の下の説明（何文字か、空欄なら26文字）
function refreshColumnHint(input) {
  const letters = columnLetters(input.value);
  input.closest('.col-box').querySelector('.col-hint').textContent = letters ? t('col.count', { n: letters.length }) : t('col.any');
}

// 列の欄の値を英字だけ・重複なしにそろえる。IME の変換中は書き換えない（変換が途切れるため）
function tidyColumn(input) {
  const tidy = columnLetters(input.value);
  if (tidy !== input.value) input.value = tidy;
  refreshColumnHint(input);
}

// 列の欄を n 個にする。残せる欄の値は残す
function renderColumns(n, values = null) {
  const old = columnInputs().map((i) => i.value);
  const box = $('#columnsContainer');
  box.replaceChildren();
  for (let i = 0; i < n; i++) {
    const id = `col-${i + 1}`;
    const input = el('input', { type: 'text', id, autocomplete: 'off', spellcheck: false, maxLength: 60, placeholder: t('col.placeholder') });
    input.value = values ? values[i] ?? '' : old[i] ?? '';
    input.setAttribute('aria-describedby', `${id}-hint`);
    input.addEventListener('input', (e) => {
      if (e.isComposing) return;
      tidyColumn(input);
      markStale();
    });
    input.addEventListener('compositionend', () => tidyColumn(input));
    const label = el('label', { htmlFor: id, text: t('col.title', { n: i + 1 }) });
    label.setAttribute('aria-label', t('col.label', { n: i + 1 }));
    const hint = el('p', { class: 'hint col-hint', id: `${id}-hint` });
    box.append(el('div', { class: 'col-box' }, [label, input, hint]));
    tidyColumn(input);
  }
}

// ===== Dictionary sources =====
const sources = [
  { key: 'builtin', kind: 'builtin', words: BUILTIN_WORDS, lines: BUILTIN_WORDS.length, duplicates: 0, invalid: 0, enabled: true }
];
for (const w of BUNDLED_WORDLISTS) {
  sources.push({ key: `bundled:${w.id}`, kind: 'bundled', id: w.id, file: w.file, words: null, expected: w.words, lines: w.lines,
    enabled: false, loading: false });
}
let pasteCount = 0;
let userCount = 0;
let dictWords = [];
let dictSet = new Set();
let partialSet = new Set();

function nameOf(s) {
  if (s.kind === 'builtin') return t('dictionary.builtin');
  if (s.kind === 'bundled') return t(`dictionary.bundled.${s.id}`);
  if (s.kind === 'paste') return t('dictionary.pasted', { n: s.pasteNo });
  return s.name;
}

function enabledSources() {
  return sources.filter((s) => s.enabled && s.words);
}

function rebuildDictionary(focusKey = null) {
  dictSet = new Set(enabledSources().flatMap((s) => s.words));
  dictWords = [...dictSet];
  partialSet = new Set(dictWords.filter((w) => w.length >= MIN_PARTIAL_WORD));
  $('#wordCount').textContent = fmt(dictWords.length);
  renderDictionaryList(focusKey);
  // 結果を出しているなら、辞書の照合と印を新しい辞書で描き直す（どちらも速い）
  if (state.cipher) {
    computeCipher();
    renderCipher();
  }
  if (state.result) {
    computeDictionary();
    renderResults();
  }
}

function wordCountText(s) {
  const removed = [];
  if (s.duplicates) removed.push(t('dictionary.removedDuplicates', { n: fmt(s.duplicates) }));
  if (s.invalid) removed.push(t('dictionary.removedInvalid', { n: fmt(s.invalid) }));
  if (!removed.length) return t('dictionary.words', { n: fmt(s.words.length) });
  return t('dictionary.wordsDetail', { n: fmt(s.words.length), lines: fmt(s.lines), removed: removed.join(t('dictionary.removedJoin')) });
}

function kindLabel(s) {
  return t({ builtin: 'dictionary.kindBuiltin', bundled: 'dictionary.kindBundled', file: 'dictionary.kindFile', paste: 'dictionary.kindPaste' }[s.kind]);
}

// 一覧は描き直すので、フォーカスがあったチェックボックスは描き直したあとの同じ項目へ戻す
function renderDictionaryList(focusKey = null) {
  const list = $('#dictListContainer');
  const active = document.activeElement;
  const keep = focusKey || (active && list.contains(active) && active.dataset.key) || null;
  list.replaceChildren();
  for (const s of sources) {
    const box = el('input', { type: 'checkbox', checked: s.enabled, disabled: s.loading || (s.kind === 'bundled' && IS_FILE) });
    box.dataset.key = s.key;
    let count;
    if (s.loading) count = t('dictionary.loading');
    else if (!s.words) count = t('dictionary.notLoaded', { n: fmt(s.expected) });
    else count = wordCountText(s);
    const item = el('li', { class: 'dict-item' }, [
      el('label', { class: 'dict-checkbox' }, [box, el('span', { class: 'dict-item-name', text: nameOf(s) })]),
      el('span', { class: 'dict-item-kind', text: kindLabel(s) }),
      el('span', { class: 'dict-item-count', text: count })
    ]);
    if (s.kind === 'file' || s.kind === 'paste') {
      const remove = el('button', { type: 'button', class: 'btn btn-ghost btn-small', text: t('dictionary.remove') });
      remove.dataset.remove = s.key;
      remove.setAttribute('aria-label', t('dictionary.removeLabel', { name: nameOf(s) }));
      item.append(remove);
    }
    list.append(item);
  }
  if (keep) {
    const again = [...list.querySelectorAll('input[data-key]')].find((x) => x.dataset.key === keep);
    if (again) again.focus();
  }
}

async function loadBundled(source) {
  source.loading = true;
  renderDictionaryList();
  try {
    const resp = await fetch(source.file);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const parsed = parseWordList(await resp.text());
    Object.assign(source, { words: parsed.words, lines: parsed.lines, duplicates: parsed.duplicates, invalid: parsed.invalid, enabled: true });
    return true;
  } catch (e) {
    source.enabled = false;
    setStatus($('#dictStatus'), t('dictionary.errorFetch', { name: nameOf(source), detail: e.message }), true);
    return false;
  } finally {
    source.loading = false;
  }
}

async function toggleSource(key, on) {
  const s = sources.find((x) => x.key === key);
  if (!s) return;
  if (on && !s.words && s.kind === 'bundled') {
    const ok = await loadBundled(s);
    rebuildDictionary(key);
    if (ok) setStatus($('#dictStatus'), t('dictionary.statusLoaded', { name: nameOf(s), n: fmt(s.words.length), total: fmt(dictWords.length) }));
    return;
  }
  s.enabled = on;
  rebuildDictionary();
  setStatus($('#dictStatus'), t('dictionary.statusToggled', { total: fmt(dictWords.length) }));
}

function addUserDictionary(kind, name, text, extra = {}) {
  const parsed = parseWordList(text);
  if (!parsed.words.length) return setStatus($('#dictStatus'), t('dictionary.errorEmpty'), true);
  if (parsed.words.length > MAX_DICTIONARY_WORDS) {
    return setStatus($('#dictStatus'), t('dictionary.errorTooManyWords', { n: fmt(parsed.words.length), limit: fmt(MAX_DICTIONARY_WORDS) }), true);
  }
  const existing = sources.find((s) => (s.kind === 'file' || s.kind === 'paste') && s.name === name);
  const fields = { words: parsed.words, lines: parsed.lines, duplicates: parsed.duplicates, invalid: parsed.invalid };
  if (existing) {
    Object.assign(existing, fields);
  } else {
    userCount += 1;
    sources.push({ key: `${kind}:${userCount}`, kind, name, enabled: true, ...extra, ...fields });
  }
  rebuildDictionary();
  const msg = existing ? 'dictionary.statusReplaced' : 'dictionary.statusLoaded';
  setStatus($('#dictStatus'), t(msg, { name, n: fmt(parsed.words.length), total: fmt(dictWords.length) }));
}

function formatBytes(n) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(n / 1024)}KB`;
}

// ===== Generate =====
// result: { cols, total, top: [{key, logw}], kept }、dict: [{word, logw}]、shown＝表示している件数
// cipher: { letters, L, ranks, ranking }（暗号文から列の候補を作ったとき）
const state = { result: null, dict: [], rows: [], shown: PAGE, cipher: null };

// 試し解き: 暗号文があり、鍵の長さが今の文字数と同じなら、その鍵で戻した文の先頭を返す
function trialText(key) {
  if (!state.cipher || state.cipher.L !== key.length) return null;
  return decryptVigenere(state.cipher.letters.slice(0, PREVIEW), key);
}

function trialActive() {
  return Boolean(state.cipher && state.result && state.cipher.L === state.result.cols.length);
}

function readKeep() {
  const el2 = $('#keep');
  if (el2.validity && el2.validity.badInput) return NaN;
  const raw = String(el2.value).trim();
  const n = raw === '' ? DEFAULT_KEEP : /^\d+$/.test(raw) ? Number(raw) : NaN;
  return n >= 1 && n <= MAX_KEEP ? n : NaN;
}

function clearResults() {
  state.result = null;
  state.dict = [];
  state.rows = [];
  $('#staleNote').hidden = true;
  $('#resultsSection').hidden = true;
  $('#dictSection').hidden = true;
  $('#exportInfo').textContent = '';
}

// 列の入力を変えたら、表示中の結果は前の入力のもの。消さずに、もう一度作るよう注記する
function markStale() {
  if (!state.result) return;
  const note = $('#staleNote');
  note.textContent = t('gen.stale');
  note.hidden = false;
}

function run() {
  const status = $('#status');
  const inputs = columnInputs();
  if (!inputs.length) return setStatus(status, t('gen.noLength'), true);
  const keep = readKeep();
  if (Number.isNaN(keep)) return setStatus(status, t('gen.keepInvalid', { max: fmt(MAX_KEEP) }), true);
  const ignored = inputs.reduce((n, i) => n + normalizeLetters(i.value).ignored, 0);
  inputs.forEach(tidyColumn);
  const cols = buildColumns(inputs.map((i) => i.value));
  setStatus(status, t('gen.running'));
  $('#runBtn').disabled = true;
  // 「計算中」を画面に出してから計算する（鍵長20・5万件で2秒ほど）
  setTimeout(() => {
    try {
      const total = countCombinations(cols);
      const top = topCombinations(cols, keep);
      state.result = { cols, total, top, kept: keep };
      state.shown = PAGE;
      computeDictionary();
      $('#staleNote').hidden = true;
      $('#resultsSection').hidden = false;
      $('#dictSection').hidden = false;
      $('#exportInfo').textContent = '';
      renderResults();
      setStatus(status, ignored ? t('gen.ignored', { n: ignored }) : '');
    } finally {
      $('#runBtn').disabled = false;
    }
  }, 0);
}

// 辞書の照合と、候補ごとの「含む辞書の語」を求める（実行のときと、辞書を変えたときだけ。表示のたびには計算しない）
function computeDictionary() {
  if (!state.result) {
    state.dict = [];
    state.rows = [];
    return;
  }
  state.dict = scoreDictionary(state.result.cols, dictWords);
  state.rows = state.result.top.map((r) => ({ ...r, contains: findWordsInKey(r.key, partialSet) }));
}

// 表に出す候補（部分一致の絞り込みを反映）
function visibleRows() {
  return $('#partialCheck').checked ? state.rows.filter((r) => r.contains.length) : state.rows;
}

function keyCell(key, contains) {
  const code = el('code');
  let at = 0;
  for (const f of contains) {
    if (f.start > at) code.append(key.slice(at, f.start));
    code.append(el('mark', { text: key.slice(f.start, f.end) }));
    at = f.end;
  }
  if (at < key.length) code.append(key.slice(at));
  return code;
}

function renderResults() {
  if (!state.result) return;
  const { total, top, kept } = state.result;
  const all = BigInt(top.length) === total;
  $('#summaryLine').textContent = all ? t('gen.summaryAll', { total: total.toLocaleString() })
    : t('gen.summary', { total: total.toLocaleString(), kept: fmt(kept) });
  const equal = top.length > 1 && Math.abs(top[0].logw - top[top.length - 1].logw) < 1e-12;
  $('#equalNote').hidden = !equal;
  $('#equalNote').textContent = equal ? t('gen.equal') : '';
  const rows = visibleRows();
  const shown = rows.slice(0, state.shown);
  const tbody = $('#resultTable tbody');
  const trial = trialActive();
  for (const th of document.querySelectorAll('.trial-col')) th.hidden = !trial;
  const frag = document.createDocumentFragment();
  shown.forEach((r, i) => {
    const words = r.contains.map((f) => f.word);
    const note = dictSet.has(r.key) ? t('gen.inDictionary') : words.length ? t('gen.contains', { words: words.join(', ') }) : t('gen.none');
    const tr = el('tr', {}, [
      el('td', { text: String(i + 1) }),
      el('td', {}, [keyCell(r.key, r.contains)]),
      el('td', { text: formatShare(r.logw) }),
      el('td', { text: note })
    ]);
    if (trial) tr.append(el('td', {}, [el('code', { text: trialText(r.key) })]));
    frag.append(tr);
  });
  tbody.replaceChildren(frag);
  let info = shown.length < rows.length ? t('gen.shown', { total: fmt(rows.length), shown: fmt(shown.length) })
    : t('gen.shownAll', { total: fmt(rows.length) });
  if ($('#partialCheck').checked) info += t('gen.filtered', { n: fmt(rows.length) });
  $('#resultInfo').textContent = info;
  const more = $('#moreBtn');
  more.hidden = shown.length >= rows.length;
  more.textContent = t('gen.more', { n: fmt(Math.min(PAGE, rows.length - shown.length)) });
  renderDictionary();
}

function renderDictionary() {
  const tbody = $('#dictTable tbody');
  const frag = document.createDocumentFragment();
  const trial = trialActive();
  state.dict.slice(0, PAGE).forEach((d, i) => {
    const tr = el('tr', {}, [
      el('td', { text: String(i + 1) }),
      el('td', {}, [el('code', { text: d.word })]),
      el('td', { text: formatShare(d.logw) })
    ]);
    if (trial) tr.append(el('td', {}, [el('code', { text: trialText(d.word) })]));
    frag.append(tr);
  });
  tbody.replaceChildren(frag);
  const len = state.result ? state.result.cols.length : 0;
  $('#dictSummary').textContent = state.dict.length
    ? t('dict.summary', { total: fmt(dictWords.length), len, n: fmt(state.dict.length) })
    : t('dict.noMatch');
}

// ===== Cipher（暗号文から列の候補を作る） =====
function readInt(sel, min, max) {
  const node = $(sel);
  if (node.validity && node.validity.badInput) return NaN;
  const raw = String(node.value).trim();
  const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
  return n >= min && n <= max ? n : NaN;
}

function estimateKeyLength() {
  const out = $('#estimateResult');
  const letters = cipherLetters($('#cipherText').value);
  if (!letters) return setStatus(out, t('cipher.noText'), true);
  const { candidates, curve, periodFound } = keyLengthCandidates(letters.slice(0, MAX_CIPHER_LETTERS));
  const ic = Object.fromEntries(curve.map((p) => [p.k, p.ic]));
  const list = candidates.slice(0, 3).map((k) => t('cipher.estimateItem', { k, ic: ic[k].toFixed(3) })).join(t('cipher.estimateJoin'));
  setStatus(out, t(periodFound ? 'cipher.estimate' : 'cipher.estimateNone', { list }));
  if (candidates.length) $('#cipherKeyLength').value = String(candidates[0]);
}

function computeCipher() {
  const c = state.cipher;
  c.ranking = scoreWordsByCipher(c.letters, dictWords, c.L);
}

// 暗号文の長さ以下で最も長い測定の行（24字未満は 24 字の行を「目安」として返す）
function accuracyRow(n) {
  const large = sources.some((s) => s.id === 'twelvedicts' && s.enabled && s.words);
  const table = large ? ACCURACY.large : ACCURACY.base;
  const rows = table.rows.filter((r) => r.length <= n);
  return { row: rows.length ? rows[rows.length - 1] : table.rows[0], below: !rows.length, dict: t(large ? 'cipher.dictLarge' : 'cipher.dictBase') };
}

function analyzeCipher() {
  const status = $('#cipherStatus');
  const { letters } = normalizeLetters($('#cipherText').value);
  if (!letters) return setStatus(status, t('cipher.noText'), true);
  if (letters.length > MAX_CIPHER_LETTERS) return setStatus(status, t('cipher.tooLong', { n: fmt(letters.length), limit: fmt(MAX_CIPHER_LETTERS) }), true);
  const L = readInt('#cipherKeyLength', 1, MAX_KEY_LENGTH);
  if (Number.isNaN(L)) return setStatus(status, t('cipher.keyLengthInvalid'), true);
  const k = readInt('#perColumn', 1, 26);
  if (Number.isNaN(k)) return setStatus(status, t('cipher.perColumnInvalid'), true);
  if (letters.length < L) return setStatus(status, t('cipher.tooShort', { n: letters.length, len: L }), true);
  const ranks = rankColumns(letters, L);
  state.cipher = { letters, L, ranks, ranking: [] };
  computeCipher();
  // 列ごとの上位 k 文字を列の欄へ入れ、組み合わせを作る
  $('#keyLength').value = String(L);
  renderColumns(L, ranks.map((col) => col.slice(0, k).map((x) => x.letter).join('')));
  renderCipher();
  setStatus(status, letters.length < 24 ? t('cipher.short', { n: letters.length }) : t('cipher.done', { k }));
  run();
}

function cipherLink(text, href) {
  return el('li', {}, [el('a', { href, text, target: '_blank', rel: 'noopener noreferrer' })]);
}

function renderCipher() {
  const c = state.cipher;
  $('#cipherSection').hidden = !c;
  if (!c) return;
  const pct = (x, row) => `${Math.round((x / row.trials) * 100)}%`;
  $('#cipherSummary').textContent = c.ranking.length
    ? t('cipher.summary', { n: fmt(c.letters.length), len: c.L, m: fmt(c.ranking.length) })
    : t('cipher.noWords', { len: c.L });
  const acc = accuracyRow(c.letters.length);
  const scale = t('cipher.scale', { english: ENGLISH_EXPECTED.toFixed(2), random: RANDOM_EXPECTED.toFixed(2) });
  const measured = acc.below ? t('cipher.accuracyBelow', { rank1: pct(acc.row.rank1, acc.row), top5: pct(acc.row.top5, acc.row) })
    : t('cipher.accuracy', { dict: acc.dict, at: acc.row.length, rank1: pct(acc.row.rank1, acc.row), top5: pct(acc.row.top5, acc.row),
      perColumn: pct(acc.row.perColumn, acc.row) });
  $('#cipherAccuracy').textContent = `${scale} ${measured}`;
  const frag = document.createDocumentFragment();
  c.ranking.slice(0, CIPHER_ROWS).forEach((r, i) => {
    frag.append(el('tr', {}, [
      el('td', { text: String(i + 1) }),
      el('td', {}, [el('code', { text: r.word })]),
      el('td', { text: r.score.toFixed(3) }),
      el('td', {}, [el('code', { text: decryptVigenere(c.letters.slice(0, PREVIEW), r.word) })])
    ]));
  });
  $('#cipherTable tbody').replaceChildren(frag);
  $('#cipherInfo').textContent = c.ranking.length > CIPHER_ROWS
    ? t('cipher.shown', { shown: fmt(CIPHER_ROWS), total: fmt(c.ranking.length) }) : '';
  const ranks = document.createDocumentFragment();
  c.ranks.forEach((col, j) => {
    ranks.append(el('tr', {}, [
      el('th', { scope: 'row', text: t('cipher.col', { n: j + 1 }) }),
      ...col.slice(0, 5).map((x) => el('td', { text: t('cipher.cell', { letter: x.letter, score: x.score.toFixed(2) }) }))
    ]));
  });
  $('#columnRankTable tbody').replaceChildren(ranks);
  const q = encodeURIComponent(c.letters);
  $('#cipherLinks').replaceChildren(
    // 「#」より後ろで渡す（サーバーへ送られず、URLの長さの上限もない。Day017・Day030 は #text= を先に読む）
    cipherLink(t('cipher.linkVigenere'), `${TOOL_BASE}vigenere-cipher-tool/#text=${q}`),
    cipherLink(t('cipher.linkDivider'), `${TOOL_BASE}modular-text-divider/#text=${q}&n=${c.L}`)
  );
}

function exportCipher(format) {
  const info = $('#cipherStatus');
  if (!state.cipher || !state.cipher.ranking.length) return setStatus(info, t('export.nothing'), true);
  const records = state.cipher.ranking.map((r, i) => ({
    rank: i + 1, key: r.word, score: Number(r.score.toFixed(6)), plaintext: decryptVigenere(state.cipher.letters.slice(0, EXPORT_PREVIEW), r.word)
  }));
  const file = `alphaloom_cipher_${stamp()}.${format}`;
  if (format === 'csv') {
    const header = Object.keys(records[0]);
    download(toCsv(header, records.map((r) => header.map((key) => r[key]))), file, 'text/csv;charset=utf-8');
  } else {
    download(`${JSON.stringify(records, null, 2)}\n`, file, 'application/json');
  }
  setStatus(info, t('export.done', { n: fmt(records.length), file }));
}

// ===== Export =====
function download(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function exportResults(format) {
  const info = $('#exportInfo');
  if (!state.result) return setStatus(info, t('export.nothing'), true);
  const rows = visibleRows();
  if (!rows.length) return setStatus(info, t('export.nothing'), true);
  const records = rows.map((r, i) => ({
    rank: i + 1, key: r.key, weight: Math.exp(r.logw), inDictionary: dictSet.has(r.key), contains: r.contains.map((f) => f.word).join(' ')
  }));
  const base = `alphaloom_${$('#partialCheck').checked ? 'partial' : 'keys'}_${stamp()}`;
  let file;
  if (format === 'txt') {
    file = `${base}.txt`;
    download(`${records.map((r) => r.key).join('\n')}\n`, file, 'text/plain;charset=utf-8');
  } else if (format === 'csv') {
    file = `${base}.csv`;
    const header = Object.keys(records[0]);
    download(toCsv(header, records.map((r) => header.map((k) => r[k]))), file, 'text/csv;charset=utf-8');
  } else {
    file = `${base}.json`;
    download(`${JSON.stringify(records, null, 2)}\n`, file, 'application/json');
  }
  setStatus(info, t('export.done', { n: fmt(records.length), file }));
}

function exportDictionary(format) {
  const info = $('#exportInfo');
  if (!state.dict.length) return setStatus(info, t('export.nothing'), true);
  const records = state.dict.map((d, i) => ({ rank: i + 1, word: d.word, weight: Math.exp(d.logw) }));
  const file = `alphaloom_dictionary_${stamp()}.${format}`;
  if (format === 'csv') {
    const header = Object.keys(records[0]);
    download(toCsv(header, records.map((r) => header.map((k) => r[k]))), file, 'text/csv;charset=utf-8');
  } else {
    download(`${JSON.stringify(records, null, 2)}\n`, file, 'application/json');
  }
  setStatus(info, t('export.done', { n: fmt(records.length), file }));
}

// ===== Events =====
function bindEvents() {
  const sel = $('#keyLength');
  for (let i = 1; i <= MAX_KEY_LENGTH; i++) sel.append(el('option', { value: String(i), text: String(i) }));
  sel.addEventListener('change', () => {
    renderColumns(Number(sel.value));
    markStale();
  });
  $('#applyPatternBtn').addEventListener('click', () => {
    const cols = parsePattern($('#pattern').value);
    if (!cols) return setStatus($('#status'), t('gen.patternInvalid', { max: MAX_KEY_LENGTH }), true);
    sel.value = String(cols.length);
    renderColumns(cols.length, cols);
    setStatus($('#status'), t('gen.patternApplied', { n: cols.length }));
  });
  $('#pattern').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      $('#applyPatternBtn').click();
    }
  });
  $('#formGen').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!$('#runBtn').disabled) run();
  });
  $('#clearBtn').addEventListener('click', () => {
    columnInputs().forEach((i) => { i.value = ''; refreshColumnHint(i); });
    $('#pattern').value = '';
    setStatus($('#status'), '');
    clearResults();
  });
  $('#partialCheck').addEventListener('change', () => {
    state.shown = PAGE;
    renderResults();
  });
  $('#moreBtn').addEventListener('click', () => {
    state.shown += PAGE;
    renderResults();
  });
  $('#formCipher').addEventListener('submit', (e) => {
    e.preventDefault();
    analyzeCipher();
  });
  $('#estimateBtn').addEventListener('click', estimateKeyLength);
  $('#clearCipherBtn').addEventListener('click', () => {
    $('#cipherText').value = '';
    setStatus($('#cipherStatus'), '');
    setStatus($('#estimateResult'), '');
    state.cipher = null;
    renderCipher();
    renderResults();
  });
  $('#exportCipherCsvBtn').addEventListener('click', () => exportCipher('csv'));
  $('#exportCipherJsonBtn').addEventListener('click', () => exportCipher('json'));
  $('#exportTxtBtn').addEventListener('click', () => exportResults('txt'));
  $('#exportCsvBtn').addEventListener('click', () => exportResults('csv'));
  $('#exportJsonBtn').addEventListener('click', () => exportResults('json'));
  $('#exportDictCsvBtn').addEventListener('click', () => exportDictionary('csv'));
  $('#exportDictJsonBtn').addEventListener('click', () => exportDictionary('json'));

  $('#dictListContainer').addEventListener('change', (e) => {
    const key = e.target.dataset && e.target.dataset.key;
    if (key) toggleSource(key, e.target.checked);
  });
  $('#dictListContainer').addEventListener('click', (e) => {
    const button = e.target.closest('button[data-remove]');
    if (!button) return;
    const i = sources.findIndex((s) => s.key === button.dataset.remove);
    if (i < 0) return;
    const [removed] = sources.splice(i, 1);
    const next = sources[Math.min(i, sources.length - 1)];
    rebuildDictionary(next ? next.key : null);
    setStatus($('#dictStatus'), t('dictionary.statusRemoved', { name: nameOf(removed), total: fmt(dictWords.length) }));
  });
  $('#loadWordlistBtn').addEventListener('click', async () => {
    const input = $('#wordlistFile');
    const file = input.files && input.files[0];
    if (!file) return setStatus($('#dictStatus'), t('dictionary.errorNoFile'), true);
    if (file.size > MAX_FILE_BYTES) {
      return setStatus($('#dictStatus'), t('dictionary.errorTooLarge', { size: formatBytes(file.size), limit: formatBytes(MAX_FILE_BYTES) }), true);
    }
    try {
      addUserDictionary('file', displayName(file.name) || 'wordlist.txt', await file.text());
      input.value = '';
    } catch (e) {
      setStatus($('#dictStatus'), t('dictionary.errorRead', { detail: e.message }), true);
    }
  });
  $('#addPastedBtn').addEventListener('click', () => {
    const area = $('#pasteWords');
    if (!area.value.trim()) return setStatus($('#dictStatus'), t('dictionary.errorPasteEmpty'), true);
    pasteCount += 1;
    addUserDictionary('paste', t('dictionary.pasted', { n: pasteCount }), area.value, { pasteNo: pasteCount });
    area.value = '';
  });
}

// ===== Language =====
// 言語を切り替える: 静的な文言、テーマのボタン、列の欄、辞書の一覧、表示中の結果を今の言語で描き直す（状態の表示は消す）
function switchLanguage(lang) {
  useLanguage(lang);
  refreshThemeButton($('#btnTheme'));
  renderColumns(columnInputs().length);
  renderDictionaryList();
  for (const sel of ['#status', '#dictStatus', '#exportInfo', '#cipherStatus', '#estimateResult']) setStatus($(sel), '');
  if (IS_FILE) $('#dictProtocolNote').textContent = t('dictionary.fileProtocol');
  if (!$('#staleNote').hidden) $('#staleNote').textContent = t('gen.stale');
  renderCipher();
  renderResults();
}

// ===== Init =====
async function init() {
  useLanguage(initialLanguage());
  $('#btnLang').addEventListener('click', () => {
    const next = document.documentElement.lang === 'ja' ? 'en' : 'ja';
    switchLanguage(next);
    saveLanguage(next);
  });
  initThemeToggle($('#btnTheme'));
  initTabs($('.tab-nav'));
  bindEvents();
  // 既定は鍵長5（列を出しておくと編集しやすい）
  $('#keyLength').value = '5';
  renderColumns(5);
  rebuildDictionary();
  document.documentElement.setAttribute('data-ready', 'true');
  if (IS_FILE) {
    const note = $('#dictProtocolNote');
    note.textContent = t('dictionary.fileProtocol');
    note.hidden = false;
  } else {
    const defaults = sources.filter((s) => s.kind === 'bundled' && DEFAULT_WORDLISTS.includes(s.id));
    await Promise.all(defaults.map((s) => loadBundled(s)));
    rebuildDictionary();
  }
  applyParams();
}

// #text=…&n=…（または ?text=…&n=…）で渡された暗号文と鍵の長さを入れる。鍵の長さがあれば列の候補まで作り、なければ鍵の長さを推定する
function applyParams() {
  const { text, n } = readParams(window.location.search, window.location.hash);
  // 読み込んだら URL から text と n を消す（replaceState なので「戻る」の回数は増えない）
  const cleaned = urlWithoutHandoff(window.location.href);
  if (cleaned !== null) {
    try {
      history.replaceState(history.state, '', cleaned);
    } catch {
      // 消せない環境でも、読み込みはそのまま続ける
    }
  }
  if (!text) return;
  $('#cipherText').value = text;
  if (n) {
    $('#cipherKeyLength').value = String(n);
    analyzeCipher();
  } else {
    estimateKeyLength();
  }
}

init();
