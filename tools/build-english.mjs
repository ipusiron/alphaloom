// 英語の文字の出現数を、学習用の英文の抜粋から数えて js/english.js に書き出す
// 使い方: node tools/build-english.mjs
// 英文: Project Gutenberg #1342 Pride and Prejudice（Jane Austen）の本文から英字だけを取り出した抜粋（tools/corpus/train-pg1342.txt）
// Day044 Cipher Clairvoyance と同じファイル。米国でパブリックドメイン
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function letterCounts(text) {
  const counts = new Array(26).fill(0);
  for (const ch of text) {
    const k = ch.charCodeAt(0) - 65;
    if (k >= 0 && k < 26) counts[k] += 1;
  }
  return counts;
}

export function readCorpus(name) {
  return fs.readFileSync(path.join(ROOT, 'tools', 'corpus', name), 'utf8').replace(/[^A-Z]/g, '');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const counts = letterCounts(readCorpus('train-pg1342.txt'));
  const out = [
    '// 自動生成（tools/build-english.mjs）。手で書き換えない',
    '// 英語の文字の出現数（A〜Z）。Project Gutenberg #1342 Pride and Prejudice の抜粋（tools/corpus/train-pg1342.txt）から数えた',
    'export const ENGLISH_COUNTS = [',
    `  ${counts.slice(0, 13).join(', ')},`,
    `  ${counts.slice(13).join(', ')}`,
    '];',
    ''
  ];
  fs.writeFileSync(path.join(ROOT, 'js', 'english.js'), out.join('\n'));
  console.log('js/english.js', counts.reduce((a, b) => a + b, 0));
}
