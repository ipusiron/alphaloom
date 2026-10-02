// 自動生成（tools/measure-accuracy.mjs）。手で書き換えない
// 鍵が英単語（english_5067・english_1842 の語、長さ4〜8）のヴィジュネル暗号で、暗号文の長さごとに鍵が当たった回数
// perColumn＝列ごとの1位をつないだ鍵が正解、rank1／top5＝辞書の語を英語らしさで並べた1位／上位5位に正解
// base＝最初から使う辞書（内蔵＋english_5067＋english_1842）、large＝それに大きい英単語辞書（12dicts）を足したもの
// 評価の英文: tools/corpus/eval-pg98.txt、各長さで鍵の長さ4〜8を300回ずつ（種 20261003）
export const ACCURACY = {
  base: {
    words: 3241,
    rows: [
      {
        length: 24,
        trials: 1500,
        perColumn: 25,
        rank1: 1212,
        top5: 1472
      },
      {
        length: 40,
        trials: 1500,
        perColumn: 163,
        rank1: 1453,
        top5: 1499
      },
      {
        length: 60,
        trials: 1500,
        perColumn: 465,
        rank1: 1481,
        top5: 1500
      },
      {
        length: 100,
        trials: 1500,
        perColumn: 997,
        rank1: 1500,
        top5: 1500
      },
      {
        length: 160,
        trials: 1500,
        perColumn: 1394,
        rank1: 1500,
        top5: 1500
      }
    ]
  },
  large: {
    words: 64696,
    rows: [
      {
        length: 24,
        trials: 1500,
        perColumn: 25,
        rank1: 783,
        top5: 1217
      },
      {
        length: 40,
        trials: 1500,
        perColumn: 163,
        rank1: 1264,
        top5: 1485
      },
      {
        length: 60,
        trials: 1500,
        perColumn: 465,
        rank1: 1430,
        top5: 1499
      },
      {
        length: 100,
        trials: 1500,
        perColumn: 997,
        rank1: 1495,
        top5: 1500
      },
      {
        length: 160,
        trials: 1500,
        perColumn: 1394,
        rank1: 1500,
        top5: 1500
      }
    ]
  }
};
