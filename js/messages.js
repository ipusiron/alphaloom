// 画面に出す文言。ロジックはキーと値だけを返し、ここで文にする
// {name} の形の置き場所に値を入れる。言語は setLanguage() で切り替える。t() は今の言語の辞書を引き、なければ日本語を使う

const JA = {
  // 列
  'col.title': '列{n}',
  'col.label': '列{n}の候補文字',
  'col.placeholder': '例: CAB（空欄可）',
  'col.any': '空欄＝A〜Zの26文字',
  'col.count': '{n} 文字（先頭ほど重い）',
  // 生成
  'gen.running': '計算中…',
  'gen.noLength': '文字数を選んでください',
  'gen.keepInvalid': '保持する件数は 1〜{max} の整数で入力してください',
  'gen.patternInvalid': 'パターンは英字と「?」（どの文字でもよい1字）で、1〜{max} 文字にしてください',
  'gen.patternApplied': 'パターンを列に反映しました（{n} 文字）',
  'gen.ignored': '英字でない文字 {n} 字を無視しました',
  'gen.summary': '組み合わせは全部で {total} 通り。重みの大きい順に {kept} 件を求めました',
  'gen.summaryAll': '組み合わせは全部で {total} 通り。すべてを重みの大きい順に並べました',
  'gen.equal': '表示している候補の重みがすべて等しいため、並びは ABC 順です（空欄の列が多いとき）。列に候補文字を入れるか、下の「辞書の語との照合」を使ってください',
  'gen.shown': '{total} 件中 {shown} 件を表示',
  'gen.shownAll': '{total} 件を表示',
  'gen.filtered': '（3文字以上の辞書の語を含む候補 {n} 件）',
  'gen.more': 'さらに {n} 件を表示',
  'gen.stale': '列の入力が変わったため、この結果は前の入力のものです。もう一度「組み合わせを作る」を押してください',
  'gen.inDictionary': '辞書の語',
  'gen.contains': '含む: {words}',
  'gen.none': '—',
  // 辞書の照合
  'dict.summary': '使っている辞書の {total} 語のうち、{len} 文字で、どの位置の文字も列の候補に入っている語は {n} 語です',
  'dict.noMatch': '列の候補に合う辞書の語はありませんでした',
  // 暗号文
  'cipher.noText': '暗号文を入れてください（英字）',
  'cipher.tooLong': '暗号文が長すぎます（{n} 字。上限は {limit} 字）',
  'cipher.keyLengthInvalid': '鍵の長さは 1〜20 の整数で入れてください（わからなければ「推定」）',
  'cipher.perColumnInvalid': '列に入れる文字の数は 1〜26 の整数で入れてください',
  'cipher.tooShort': '暗号文（{n} 字）が鍵の長さ（{len}）より短いため、列を作れません',
  'cipher.short': '暗号文が {n} 字と短いため、結果は外れやすくなります',
  'cipher.done': '列ごとの上位 {k} 文字を列の欄に入れ、組み合わせを作りました',
  'cipher.estimate': '鍵の長さの候補: {list}（括弧内は列の一致指数の平均。英文ならおよそ0.066）',
  'cipher.estimateNone': '一致指数が英語並みになる周期は見つかりませんでした（短い暗号文では出にくい）。一致指数の大きい順: {list}',
  'cipher.estimateItem': '{k}（{ic}）',
  'cipher.estimateJoin': '、',
  'cipher.summary': '暗号文 {n} 字・鍵の長さ {len}。使っている辞書の {len} 文字の語 {m} 語を、その語で戻した文の英語らしさの順に並べました',
  'cipher.scale': '英語らしさは、戻した文の1文字あたりの対数尤度です（英文ならおよそ {english}、でたらめな文字ならおよそ {random}。0 に近いほど英語らしい）',
  'cipher.noWords': '使っている辞書に {len} 文字の語がありません',
  'cipher.accuracy': '実測（{dict}、鍵が英単語・暗号文 {at} 字のとき）: 辞書の1位が鍵 {rank1}、上位5位に鍵 {top5}。列ごとの1位をつないだ鍵が正解 {perColumn}',
  'cipher.accuracyBelow': '24字未満は測っていません（24字での実測: 辞書の1位が鍵 {rank1}、上位5位に鍵 {top5}）',
  'cipher.dictBase': '最初から使う辞書',
  'cipher.dictLarge': '大きい英単語辞書を足した辞書',
  'cipher.shown': '上位 {shown} 語を表示しています（{total} 語すべては「CSVで保存」「JSONで保存」で書き出せます）',
  'cipher.col': '列{n}',
  'cipher.cell': '{letter}（{score}）',
  'cipher.linkVigenere': 'Vigenère Cipher Tool（Day017）で暗号文を開く',
  'cipher.linkDivider': 'Modular Text Divider（Day030）で鍵の長さごとの列に分ける',
  // 書き出し
  'export.nothing': '書き出す結果がありません',
  'export.done': '{n} 件を {file} に書き出しました',
  // 辞書
  'dictionary.builtin': '内蔵ミニ辞書',
  'dictionary.bundled.english_5067': '一般英単語（english_5067）',
  'dictionary.bundled.english_1842': '基本英単語（english_1842）',
  'dictionary.bundled.animals': '動物名（animals）',
  'dictionary.bundled.twelvedicts': '大きい英単語辞書（12dicts 3of6game、活用形を含む）',
  'dictionary.pasted': '貼り付けた辞書 {n}',
  'dictionary.none': '辞書未選択',
  'dictionary.loading': '読み込み中…',
  'dictionary.words': '{n} 語',
  'dictionary.wordsDetail': '{n} 語（{lines} 行から{removed}を除いた数）',
  'dictionary.removedDuplicates': '重複 {n} 行',
  'dictionary.removedInvalid': '英字のない {n} 行',
  'dictionary.removedJoin': '・',
  'dictionary.kindBuiltin': '内蔵',
  'dictionary.kindBundled': '付属',
  'dictionary.kindFile': 'ファイル',
  'dictionary.kindPaste': '貼り付け',
  'dictionary.notLoaded': '{n} 語・未読み込み（チェックすると読み込みます）',
  'dictionary.remove': '削除',
  'dictionary.removeLabel': '{name} を一覧から外す',
  'dictionary.fileProtocol': 'ファイルとして直接開いているため、付属辞書は読み込めません（ブラウザーが file:// からの読み込みを止めます）。'
    + '内蔵ミニ辞書と、ファイル選択・貼り付けで足した辞書は使えます。付属辞書を使うには、公開版か、フォルダーで python -m http.server を実行して '
    + 'http://localhost:8000/ で開いてください。',
  'dictionary.statusLoaded': '「{name}」を読み込みました（{n} 語）。いま使っている辞書は合計 {total} 語です',
  'dictionary.statusToggled': 'いま使っている辞書は合計 {total} 語です',
  'dictionary.statusRemoved': '「{name}」を一覧から外しました。いま使っている辞書は合計 {total} 語です',
  'dictionary.statusReplaced': '同じ名前の「{name}」を新しい内容に置き換えました（{n} 語）',
  'dictionary.errorNoFile': '辞書ファイルを選んでください',
  'dictionary.errorTooLarge': 'ファイルが大きすぎます（{size}。上限は {limit}）',
  'dictionary.errorTooManyWords': '語が多すぎます（{n} 語。上限は {limit} 語）',
  'dictionary.errorEmpty': '英字の語が1つもありませんでした（1行に1語のテキストファイルを選んでください）',
  'dictionary.errorRead': '読み込めませんでした（{detail}）',
  'dictionary.errorFetch': '「{name}」を読み込めませんでした（{detail}）',
  'dictionary.errorPasteEmpty': '貼り付ける語を入力してください（1行に1語）',
  // テーマ
  'theme.toDark': 'ダークモードに切り替える',
  'theme.toLight': 'ライトモードに切り替える'
};

const EN = {};

export const MESSAGES = { ja: JA, en: EN };
export const LANGUAGES = ['ja', 'en'];

let current = 'ja';

export function setLanguage(lang) {
  if (LANGUAGES.includes(lang)) current = lang;
  return current;
}

export function getLanguage() {
  return current;
}

export function t(key, params = {}, lang = current) {
  const table = MESSAGES[lang] || JA;
  let text = table[key] ?? JA[key];
  if (text === undefined) return key;
  for (const [k, v] of Object.entries(params)) text = text.split(`{${k}}`).join(String(v));
  return text;
}
