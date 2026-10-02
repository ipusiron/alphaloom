// 辞書の一覧（DOM 非依存）。付属辞書は wordlists/ のテキストファイル（1行に1語）を fetch で読む。
// words＝正規化（A〜Z の大文字、重複を除く）したあとの語数。test/wordlists.test.js が実ファイルと突き合わせる

// 内蔵ミニ辞書（読み込みなしで使う、よく使う英単語と暗号・コンピューターの語。222語）。
// wordlists/english-mini-223.txt と同じ語（ファイルは ABOUT が2行あるので223行）
export const BUILTIN_WORDS = [
  'THE', 'BE', 'TO', 'OF', 'AND', 'A', 'IN', 'THAT', 'HAVE', 'I', 'IT', 'FOR', 'NOT', 'ON', 'WITH', 'HE', 'AS', 'YOU',
  'DO', 'AT', 'THIS', 'BUT', 'HIS', 'BY', 'FROM', 'THEY', 'WE', 'SAY', 'HER', 'SHE', 'OR', 'AN', 'WILL', 'MY', 'ONE',
  'ALL', 'WOULD', 'THERE', 'THEIR', 'WHAT', 'SO', 'UP', 'OUT', 'IF', 'ABOUT', 'WHO', 'GET', 'WHICH', 'GO', 'ME',
  'WHEN', 'MAKE', 'CAN', 'LIKE', 'TIME', 'NO', 'JUST', 'HIM', 'KNOW', 'TAKE', 'PEOPLE', 'INTO', 'YEAR', 'YOUR', 'GOOD',
  'SOME', 'COULD', 'THEM', 'SEE', 'OTHER', 'THAN', 'THEN', 'NOW', 'LOOK', 'ONLY', 'COME', 'ITS', 'OVER', 'THINK',
  'ALSO', 'BACK', 'AFTER', 'USE', 'TWO', 'HOW', 'OUR', 'WORK', 'FIRST', 'WELL', 'WAY', 'EVEN', 'NEW', 'WANT',
  'BECAUSE', 'ANY', 'THESE', 'GIVE', 'DAY', 'MOST', 'US', 'IS', 'ARE', 'WERE', 'WAS', 'MORE', 'MANY', 'LONG', 'GREAT',
  'MADE', 'MIGHT', 'SHOULD', 'MUST', 'EVERY', 'EVER', 'NEVER', 'RIGHT', 'LEFT', 'DOWN', 'HIGH', 'LOW', 'NEXT', 'LAST',
  'EARLY', 'LATE', 'SMALL', 'LARGE', 'OPEN', 'CLOSE', 'TRUE', 'FALSE', 'WORD', 'KEY', 'CIPHER', 'CODE', 'PLAIN',
  'TEXT', 'LETTER', 'ALPHA', 'BETA', 'GAMMA', 'DELTA', 'SHIFT', 'ROUND', 'BLOCK', 'TABLE', 'INDEX', 'COUNT', 'MATCH',
  'SCORE', 'RANK', 'LIST', 'ARRAY', 'VALUE', 'MODEL', 'TRAIN', 'TEST', 'DATA', 'INFO', 'INPUT', 'OUTPUT', 'SEARCH',
  'FIND', 'FILTER', 'PART', 'FULL', 'PARTIAL', 'WHOLE', 'BEST', 'TOP', 'LOWER', 'UPPER', 'CASE', 'ASCII', 'RANDOM',
  'ORDER', 'GROUP', 'LEVEL', 'POINT', 'LINE', 'GRAPH', 'COLOR', 'WHITE', 'BLACK', 'GREEN', 'BLUE', 'RED', 'GRAY',
  'LIGHT', 'DARK', 'FAST', 'SLOW', 'SAFE', 'RISK', 'ATTACK', 'DEFEND', 'SECRET', 'PUBLIC', 'PRIVATE', 'OPENKEY',
  'TOKEN', 'PASSWORD', 'HASH', 'SALT', 'PEPPER', 'WORDS', 'BOOK', 'READ', 'WRITE', 'EDIT', 'SAVE', 'LOAD', 'FETCH',
  'LOCAL', 'REMOTE', 'ONLINE', 'OFFLINE', 'SITE', 'PAGE', 'HOME', 'HELP', 'GUIDE', 'DOCS'
];

export const BUNDLED_WORDLISTS = [
  { id: 'english_5067', file: 'wordlists/english_5067.txt', lines: 5068, words: 2945 },
  { id: 'english_1842', file: 'wordlists/english_1842.txt', lines: 1842, words: 1472 },
  { id: 'animals', file: 'wordlists/animals.txt', lines: 695, words: 546 }
];

// 内蔵ミニ辞書と同じ内容のファイル（画面の一覧には出さない。自分の辞書を作るときの見本）
export const BUILTIN_FILE = 'wordlists/english-mini-223.txt';

// HTTP(S) で開いたときに最初から読み込む付属辞書
export const DEFAULT_WORDLISTS = ['english_5067', 'english_1842'];

// 利用者が読み込む辞書ファイルの上限
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_DICTIONARY_WORDS = 500000;
export const MAX_NAME_LENGTH = 80;

export function bundledById(id) {
  return BUNDLED_WORDLISTS.find((w) => w.id === id) || null;
}

// ファイル名を辞書名にする。制御文字を空白にして、長すぎれば末尾を…で切る（表示は textContent で行う）
export function displayName(name) {
  const clean = String(name ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return clean.length > MAX_NAME_LENGTH ? `${clean.slice(0, MAX_NAME_LENGTH - 1)}…` : clean;
}
