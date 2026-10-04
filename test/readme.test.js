import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseWordList, buildColumns, parsePattern, countCombinations, scoreDictionary, keyLogWeight, formatShare, topCombinations
} from '../js/loom-core.js';
import { BUILTIN_WORDS, BUILTIN_FILE, BUNDLED_WORDLISTS, DEFAULT_WORDLISTS } from '../js/wordlists.js';
import {
  encryptVigenere, decryptVigenere, rankColumns, scoreWordsByCipher, keyLengthCandidates, periodicIC, ENGLISH_EXPECTED, RANDOM_EXPECTED,
  ENGLISH_LOG, MAX_CIPHER_LETTERS, KEY_IC_THRESHOLD
} from '../js/vigenere.js';
import { ENGLISH_COUNTS } from '../js/english.js';
import { ACCURACY } from '../js/accuracy.js';
import { MAX_PARAM_TEXT } from '../js/params.js';
import { readCorpus } from '../tools/build-english.mjs';
import { TRIALS, KEY_LENGTHS } from '../tools/measure-accuracy.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const fmt = (n) => n.toLocaleString('en-US');
const pct = (x, row) => `${Math.round((x / row.trials) * 100)}%`;
const lists = Object.fromEntries(BUNDLED_WORDLISTS.map((w) => [w.id, parseWordList(read(w.file))]));
const defaultWords = [...new Set([...BUILTIN_WORDS, ...DEFAULT_WORDLISTS.flatMap((id) => lists[id].words)])];
const largeWords = [...new Set([...defaultWords, ...lists.twelvedicts.words])];

// 暗号文の例（README の「暗号文から鍵を探す仕組み」）: 評価用の英文の先頭40字を鍵 GARDEN で暗号化したもの
const evalText = readCorpus('eval-pg98.txt');
const KEY = 'GARDEN';
const CIPHER = encryptVigenere(evalText.slice(0, 40), KEY);
const L = KEY.length;
const ranking = scoreWordsByCipher(CIPHER, defaultWords, L);
const ranks = rankColumns(CIPHER, L);
const firstLetters = ranks.map((c) => c[0].letter).join('');
const matched = [...KEY].filter((ch, i) => firstLetters[i] === ch).length;
const top3 = buildColumns(ranks.map((c) => c.slice(0, 3).map((x) => x.letter).join('')));
const comboRank = topCombinations(top3, 10000).findIndex((x) => x.key === KEY) + 1;
const top3Dict = scoreDictionary(top3, defaultWords);
const estimate = keyLengthCandidates(CIPHER).candidates.slice(0, 3);
const lemonFirst = keyLengthCandidates(encryptVigenere(evalText.slice(1000, 1300), 'LEMON')).candidates[0];
const n6Large = scoreWordsByCipher(CIPHER, largeWords, L).length;
const pat = scoreDictionary(buildColumns(parsePattern('?HE??')), defaultWords);
const trials = ACCURACY.base.rows[0].trials;
const ordinal = (n) => `${n}${(n % 100 >= 11 && n % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;

const DOCS = {
  ja: {
    file: 'README.md',
    switcher: '[English](README.en.md) · 日本語',
    day: '**Day046 - 生成AIで作るセキュリティツール100**',
    weights: '🔬 重みと探索の仕組み',
    cipher: '🔐 暗号文から鍵を探す仕組み',
    dict: '📚 辞書',
    tree: '📁 ディレクトリー構造',
    about: '🛠️ このツールについて',
    images: /^assets\/screenshot\d*\.png$/,
    heads: { weights: '列の候補', dict: 'ファイル', example: '順位', accuracy: '暗号文の字数' },
    mini: '○（内蔵）',
    spec: (s) => (s.endsWith('（パターン）') ? parsePattern(s.replace('（パターン）', '')) : s.split('・').map((x) => (x === '空欄' ? '' : x))),
    total: (n) => `${fmt(n)}通り`,
    claims: [
      `内蔵ミニ辞書（${BUILTIN_WORDS.length}語）`,
      `（内蔵＋english_5067＋english_1842、${fmt(defaultWords.length)}語）`,
      `${pat.length}語の重みは等しく（${formatShare(pat[0].logw)}）`,
      `?HE??なら${pat.length}語`,
      `英文ならおよそ${ENGLISH_EXPECTED.toFixed(2)}、でたらめな文字ならおよそ${RANDOM_EXPECTED.toFixed(2)}`,
      `6文字の語${fmt(ranking.length)}語が次の順に並びます`,
      `列ごとの1位をつなぐと${firstLetters}で、6文字のうち${matched}文字しか合わない`,
      `組み合わせは${fmt(Number(countCombinations(top3)))}通りで、GARDENは${comboRank}番目になる`,
      `残るのはGARDENだけ（${formatShare(top3Dict[0].logw)}）`,
      `鍵の長さの候補は${estimate.join('・')}と出て、正しい6は入らない`,
      `推定の1位は${lemonFirst}になる`,
      `字数ごとに${fmt(trials)}回（鍵の長さ${KEY_LENGTHS[0]}〜${KEY_LENGTHS.at(-1)}を${TRIALS}回ずつ）`,
      `付属辞書を最初から使う状態（${fmt(ACCURACY.base.words)}語）、「大きい辞書を足して」は12dictsを足した状態（${fmt(ACCURACY.large.words)}語）`,
      `6文字の語は${fmt(ranking.length)}語から${fmt(n6Large)}語に増える`,
      `暗号文は${fmt(MAX_PARAM_TEXT)}字まで`,
      `暗号文は${fmt(MAX_CIPHER_LETTERS)}字まで`
    ]
  },
  en: {
    file: 'README.en.md',
    switcher: 'English · [日本語](README.md)',
    day: '**Day046 - 100 Security Tools with Generative AI**',
    weights: '🔬 How the weights and the search work',
    cipher: '🔐 Finding a key from a ciphertext',
    dict: '📚 Dictionaries',
    tree: '📁 Directory structure',
    about: '🛠️ About this tool',
    images: /^assets\/en\/screenshot\d*\.png$/,
    heads: { weights: 'Column candidates', dict: 'File', example: 'Rank', accuracy: 'Ciphertext letters' },
    mini: '○ (built-in)',
    spec: (s) => (s.endsWith(' (pattern)') ? parsePattern(s.replace(' (pattern)', '')) : s.split(', ').map((x) => (x === 'blank' ? '' : x))),
    total: (n) => fmt(n),
    claims: [
      `built-in mini dictionary (${BUILTIN_WORDS.length} words)`,
      `(built-in + english_5067 + english_1842, ${fmt(defaultWords.length)} words)`,
      `the ${pat.length} words have the same weight (${formatShare(pat[0].logw)})`,
      `${pat.length} words for ?HE??`,
      `about ${ENGLISH_EXPECTED.toFixed(2)} for English text and about ${RANDOM_EXPECTED.toFixed(2)} for random letters`,
      `the ${fmt(ranking.length)} six-letter words are ranked as follows`,
      `gives ${firstLetters}, which matches only ${matched} of the 6 letters`,
      `there are ${fmt(Number(countCombinations(top3)))} combinations and GARDEN is the ${ordinal(comboRank)}`,
      `GARDEN is the only word left in "Dictionary words that fit" (${formatShare(top3Dict[0].logw)})`,
      `suggests key lengths ${estimate.slice(0, -1).join(', ')} and ${estimate.at(-1)}, which do not include the correct 6`,
      `the first estimate is ${lemonFirst}`,
      `each length was tried ${fmt(trials)} times (${TRIALS} times for each key length from ${KEY_LENGTHS[0]} to ${KEY_LENGTHS.at(-1)})`,
      `the dictionaries used from the start (${fmt(ACCURACY.base.words)} words)`,
      `with 12dicts added (${fmt(ACCURACY.large.words)} words)`,
      `the six-letter words grow from ${fmt(ranking.length)} to ${fmt(n6Large)}`,
      `The ciphertext takes up to ${fmt(MAX_PARAM_TEXT)} letters`,
      `ciphertexts up to ${fmt(MAX_CIPHER_LETTERS)} letters`
    ]
  }
};
for (const d of Object.values(DOCS)) d.text = read(d.file);

// 見出し（## ）の後ろから、次の ## までを取り出す
function section(text, heading) {
  const i = text.indexOf(`\n## ${heading}`);
  assert.ok(i >= 0, heading);
  const rest = text.slice(i + 1);
  const end = rest.indexOf('\n## ', 3);
  return end < 0 ? rest : rest.slice(0, end);
}

// firstHeader で始まる表の本体の行（見出しと区切りの行を除く）を、セルの配列にする
function table(text, firstHeader) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`| ${firstHeader} |`));
  assert.ok(start >= 0, firstHeader);
  const rows = [];
  for (let i = start + 2; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
  return rows;
}

const h2 = (md) => md.replace(/```[\s\S]*?```/g, '').split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3));
const headings = (md) => md.replace(/```[\s\S]*?```/g, '').split('\n').filter((l) => /^#{1,4} /.test(l));

test('README の例の前提: 辞書の数と測定の表の語数が一致し、推定は正しい長さを上位3つに含まない', () => {
  assert.equal(ACCURACY.base.words, defaultWords.length);
  assert.equal(ACCURACY.large.words, largeWords.length);
  assert.equal(CIPHER, 'URDHLRXEZZEFNAGSCFGIUPVYURIBXBHEVQXEASKH');
  assert.equal(ranking[0].word, KEY);
  assert.deepEqual(top3Dict.map((d) => d.word), [KEY]);
  assert.ok(!estimate.includes(L));
  assert.equal(lemonFirst, 5);
  assert.ok(ACCURACY.base.rows.every((r) => r.trials === TRIALS * KEY_LENGTHS.length));
});

test('YAML メタデータの構造（キーの順、ブロック形式のリスト、固定の値）。YAML は README.md だけに置く', () => {
  const m = DOCS.ja.text.match(/^<!--\n---\n([\s\S]*?)\n---\n-->\n/);
  assert.ok(m, 'YAML block');
  const yaml = m[1];
  const keys = [...yaml.matchAll(/^([a-z_]+):/gm)].map((x) => x[1]);
  assert.deepEqual(keys, ['id', 'slug', 'title', 'subtitle_ja', 'subtitle_en', 'description_ja', 'description_en',
    'category_ja', 'category_en', 'difficulty', 'tags', 'repo_url', 'demo_url', 'hub']);
  for (const k of ['category_ja', 'category_en', 'tags']) assert.match(yaml, new RegExp(`^${k}:\\n  - `, 'm'), k);
  assert.match(yaml, /^id: day046$/m);
  assert.match(yaml, /^slug: alphaloom$/m);
  assert.match(yaml, /^repo_url: "https:\/\/github.com\/ipusiron\/alphaloom"$/m);
  assert.match(yaml, /^demo_url: "https:\/\/ipusiron.github.io\/alphaloom\/"$/m);
  assert.match(yaml, /^hub: true$/m);
  assert.doesNotMatch(DOCS.en.text, /^<!--/);
});

test('日英の README は同じ見出しを同じ順に持つ（階層と絵文字がそろう）', () => {
  const ja = headings(DOCS.ja.text);
  const en = headings(DOCS.en.text);
  assert.equal(en.length, ja.length);
  ja.forEach((h, i) => {
    assert.equal(en[i].match(/^#+/)[0], h.match(/^#+/)[0], `${h} / ${en[i]}`);
    if (h.startsWith('## ')) assert.equal([...en[i].slice(3)][0], [...h.slice(3)][0], `${h} / ${en[i]}`);
  });
});

for (const [lang, d] of Object.entries(DOCS)) {
  test(`${d.file}: シリーズ標準の構成（前半と後半の見出しの順、Day の表記、言語の切り替え、プロジェクトのリンク）`, () => {
    const heads = h2(d.text);
    assert.ok(d.text.includes(d.switcher));
    assert.match(d.text, /\n# AlphaLoom - .+\n/);
    assert.ok(d.text.includes(d.day));
    assert.ok(heads[0].startsWith('🌐'));
    assert.ok(heads[1].startsWith('📸'));
    assert.deepEqual(heads.slice(-4).map((h) => [...h][0]), ['📁', '💻', '📄', '🛠']);
    for (const icon of ['✨', '📖', '🎯', '🔒', '⚠', '🧪']) assert.ok(heads.some((h) => h.startsWith(icon)), icon);
    assert.match(section(d.text, d.about), /https:\/\/akademeia\.info\/\?page_id=42163/);
    for (const b of ['stars', 'forks', 'last-commit', 'license']) assert.ok(d.text.includes(`img.shields.io/github/${b}/ipusiron/alphaloom`), b);
  });

  test(`${d.file}: 強調は1節に2か所まで、箇条書きの項目名を太字にしない`, () => {
    for (const h of h2(d.text)) {
      const n = (section(d.text, h).match(/\*\*[^*\n]+\*\*/g) || []).length;
      assert.ok(n <= 2, `${h}: ${n}`);
    }
    assert.doesNotMatch(d.text, /^\s*- \*\*/m);
  });

  test(`${d.file}: 辞書の表は wordlists/ の実ファイルと一致し、本文の数値も実装と一致する`, () => {
    const rows = table(section(d.text, d.dict), d.heads.dict);
    assert.equal(rows.length, BUNDLED_WORDLISTS.length + 1);
    for (const w of BUNDLED_WORDLISTS) {
      const row = rows.find((r) => r[0] === path.basename(w.file));
      assert.ok(row, w.file);
      assert.equal(row[2], fmt(lists[w.id].lines), `${w.id} lines`);
      assert.equal(row[3], fmt(lists[w.id].words.length), `${w.id} words`);
      assert.equal(row[4], DEFAULT_WORDLISTS.includes(w.id) ? '○' : '', w.id);
    }
    const mini = parseWordList(read(BUILTIN_FILE));
    const row = rows.find((r) => r[0] === path.basename(BUILTIN_FILE));
    assert.deepEqual(row.slice(2), [fmt(mini.lines), fmt(BUILTIN_WORDS.length), d.mini]);
    for (const c of d.claims) assert.ok(d.text.includes(c), c);
  });

  test(`${d.file}: 重みと探索の仕組みの表（列の候補→組み合わせの数・辞書の語）は、実装の結果と一致する`, () => {
    const rows = table(section(d.text, d.weights), d.heads.weights);
    assert.equal(rows.length, 2);
    for (const [spec, total, words] of rows) {
      const cols = buildColumns(d.spec(spec));
      assert.equal(total, d.total(Number(countCombinations(cols))), spec);
      const dict = scoreDictionary(cols, defaultWords);
      const want = dict.map((x) => (words.includes('%') ? `${x.word} ${formatShare(x.logw)}` : x.word)).join(', ');
      assert.equal(words, want, spec);
    }
    assert.equal(keyLogWeight(buildColumns(['THS', 'HEA', 'EAI', '', 'RYS']), 'THESE'), null);
    assert.ok(new Set(pat.map((x) => formatShare(x.logw))).size === 1);
  });

  test(`${d.file}: 暗号文の例（GARDEN の順位・英語らしさ・戻した文）と実測の表は、実装と js/accuracy.js に一致する`, () => {
    const sec = section(d.text, d.cipher);
    assert.ok(sec.includes(`\`\`\`\n${CIPHER}\n\`\`\``));
    const rows = table(sec, d.heads.example);
    assert.equal(rows.length, 3);
    rows.forEach(([rank, word, score, plain], i) => {
      assert.equal(rank, String(i + 1));
      assert.equal(word, ranking[i].word);
      assert.equal(score, ranking[i].score.toFixed(3));
      assert.equal(plain, decryptVigenere(CIPHER, word));
    });
    const acc = table(sec, d.heads.accuracy);
    assert.equal(acc.length, ACCURACY.base.rows.length);
    acc.forEach((r, i) => {
      const b = ACCURACY.base.rows[i];
      const g = ACCURACY.large.rows[i];
      assert.equal(b.length, g.length);
      assert.deepEqual(r, [String(b.length), pct(b.perColumn, b), pct(b.rank1, b), pct(b.top5, b), pct(g.rank1, g), pct(g.top5, g)]);
    });
    assert.ok(d.text.includes(`https://ipusiron.github.io/alphaloom/#text=${CIPHER}&n=${L}`));
  });

  test(`${d.file}: ディレクトリー構造にすべてのファイルとディレクトリーが載り、全行に説明がある`, () => {
    const block = section(d.text, d.tree).match(/```\n([\s\S]*?)```/)[1];
    const lines = block.split('\n').filter(Boolean).slice(1);
    const listed = new Set();
    for (const line of lines) {
      const m = line.match(/^[│├└─\s]*([^\s#]+)\s+# (.+)$/);
      assert.ok(m, `説明のない行: ${line}`);
      listed.add(m[1].replace(/\/$/, ''));
    }
    const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
      .filter((x) => !['.git', 'node_modules', '.claude'].includes(x.name))
      .flatMap((x) => (x.isDirectory() ? [x.name, ...walk(path.join(dir, x.name))] : [x.name]));
    const all = walk('.');
    for (const name of all) assert.ok(listed.has(name), `ツリーにない: ${name}`);
    for (const name of listed) assert.ok(all.includes(name), `実在しない: ${name}`);
    const cols = new Set(lines.map((l) => l.indexOf(' # ')));
    assert.equal(cols.size, 1, [...cols].join(','));
  });
}

test('画面の既定値は README の記述と一致する（列に入れる文字の数3、試し解きは先頭40字）', () => {
  assert.match(read('index.html'), /id="perColumn" min="1" max="26" value="3"/);
  assert.match(read('script.js'), /^const PREVIEW = 40;$/m);
  assert.ok(DOCS.ja.text.includes('既定3文字') && DOCS.ja.text.includes('先頭40字'));
  assert.ok(DOCS.en.text.includes('3 by default') && DOCS.en.text.includes('first 40 letters'));
});

test('画像: 参照はすべて実在し、日本語版は assets/、英語版は assets/en/ の画像を使う。参照していない PNG は置かない', () => {
  const refs = {};
  for (const [lang, d] of Object.entries(DOCS)) {
    refs[lang] = [...d.text.matchAll(/!\[[^\]]*\]\((assets\/[^)]+)\)/g)].map((m) => m[1]);
    assert.equal(refs[lang].length, 4, lang);
    for (const r of refs[lang]) {
      assert.ok(fs.existsSync(path.join(ROOT, r)), r);
      assert.match(r, d.images, r);
      assert.ok(fs.statSync(path.join(ROOT, r)).size <= 300 * 1024, r);
    }
  }
  const pngs = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.png')).map((f) => `${dir}/${f}`).sort();
  assert.deepEqual(pngs('assets'), [...new Set(refs.ja)].sort());
  assert.deepEqual(pngs('assets/en'), [...new Set(refs.en)].sort());
});

test('ALGORITHM.md の例（THEIR の重み・THESE は作れない・?HE?? の15語・部分文字列171通り）は実装と一致する', () => {
  const doc = read('ALGORITHM.md');
  const cols = buildColumns(['THS', 'HEA', 'EAI', '', 'RYS']);
  assert.ok(doc.includes(`THEIRの重みは\`1/2 × 1/2 × 1/2 × 1/26 × 1/2 ≈ ${formatShare(keyLogWeight(cols, 'THEIR'))}\``));
  assert.equal(keyLogWeight(cols, 'THESE'), null);
  assert.ok(doc.includes(`当てはまる辞書の語（${pat.length}語）の重みはどれも\`1/26 × 1 × 1 × 1/26 × 1/26 ≈ ${formatShare(pat[0].logw)}\``));
  assert.ok(doc.includes(`（${fmt(defaultWords.length)}語）では一瞬で終わります`));
  let subs = 0;
  for (let len = 3; len <= 20; len++) subs += 20 - len + 1;
  assert.ok(doc.includes(`文字数20なら${subs}通り`));
});

test('ALGORITHM.md の暗号文の分析の例（列1・列4の僅差、一致指数、10,000字の推定、出現率、表示と書き出しの字数）は実装と一致する', () => {
  const doc = read('ALGORITHM.md');
  const num = (x, d = 2) => x.toFixed(d).replace('-', '−');
  const [c1, c4] = [ranks[0], ranks[3]];
  assert.equal(Math.ceil(CIPHER.length / L), 7);
  assert.ok(doc.includes(`1位の${c1[0].letter}（${num(c1[0].score)}）と2位の${c1[1].letter}（${num(c1[1].score)}）がほとんど並びます`));
  assert.ok(doc.includes(`列4も1位は${c4[0].letter}（${num(c4[0].score)}）で、正しい${c4[1].letter}は2位（${num(c4[1].score)}）です`));
  assert.equal(c1[1].letter, KEY[0]);
  assert.equal(c4[1].letter, KEY[3]);
  const ic = Object.fromEntries(periodicIC(CIPHER).map((p) => [p.k, p.ic.toFixed(3)]));
  assert.ok(doc.includes(`周期${estimate[0]}（${ic[estimate[0]]}）・${estimate[1]}（${ic[estimate[1]]}）・${estimate[2]}（${ic[estimate[2]]}）がしきい値を超え`));
  assert.ok(doc.includes(`正しい周期6は${ic[6]}で届きません`) && Number(ic[6]) < KEY_IC_THRESHOLD);
  assert.ok(doc.includes(`しきい値はDay044 Cipher Clairvoyanceと同じ`) && doc.includes(`平均が${KEY_IC_THRESHOLD}以上の周期`));
  const long = keyLengthCandidates(encryptVigenere(evalText.slice(0, 10000), KEY)).candidates.slice(0, 3);
  assert.ok(doc.includes(`10,000字を暗号化したものなら、上位は${long.join('・')}です`));
  const total = ENGLISH_COUNTS.reduce((a, b) => a + b, 0);
  assert.ok(doc.includes(`抜粋${fmt(total)}字から数えた値`) && doc.includes(`(n + 1) / (${fmt(total)} + 26)`));
  assert.ok(doc.includes(`Eは${((ENGLISH_COUNTS[4] / total) * 100).toFixed(1)}%（log p ≈ ${num(ENGLISH_LOG[4])}）`));
  assert.ok(doc.includes(`Zは${ENGLISH_COUNTS[25]}回（log p ≈ ${num(ENGLISH_LOG[25])}）`));
  assert.ok(doc.includes(`約${num(ENGLISH_EXPECTED)}、ランダムな文字列では約${num(RANDOM_EXPECTED)}`));
  const script = read('script.js');
  assert.match(script, /^const CIPHER_ROWS = 50;$/m);
  assert.match(script, /^const EXPORT_PREVIEW = 100;$/m);
  assert.ok(doc.includes('上位50語を表示し') && doc.includes('先頭100字まで書き出します'));
});
