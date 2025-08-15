# AlphaLoom - 文字組み合わせ＆生成文字列分析ツール

![GitHub Repo stars](https://img.shields.io/github/stars/ipusiron/alphaloom?style=social)
![GitHub forks](https://img.shields.io/github/forks/ipusiron/alphaloom?style=social)
![GitHub last commit](https://img.shields.io/github/last-commit/ipusiron/alphaloom)
![GitHub license](https://img.shields.io/github/license/ipusiron/alphaloom)
[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-blue?logo=github)](https://ipusiron.github.io/alphaloom/)

**Day046 - 生成AIで作るセキュリティツール100**

---

## 📜 概要

**AlphaLoom** は、列ごとの候補文字とその重みから、可能なすべての文字列パターン（鍵候補）を生成し、  信頼度順に分類・表示できるWebツールです。  

さらに、読み込んだ辞書を用いて部分一致／完全一致の照合を行い、辞書ヒットも加味した統合信頼度で候補を再ランキングできます。

ヴィジュネル暗号の終盤の鍵キーワード特定を主な用途としていますが、他の暗号や文字列解析にも応用可能な汎用設計になっています。

---

## 🪡 ツール名と由来

- **Alpha** = Alphabet（アルファベット）を指し、鍵や文字列の素材である文字群を意味します。  
- **Loom** = 織機を意味し、複数の文字を組み合わせて鍵やパターンを「織り成す」職人的プロセスを象徴します。

「Weaver」自体にも職人の意味がありますが、「Loom」にすることで  
ツール＝織機、ユーザー＝織り手、という関係性を表現し、  
利用者が自らの手で鍵候補を作り出すイメージを込めています。

---

## 🌐 デモページ

👉 **[https://ipusiron.github.io/alphaloom/](https://ipusiron.github.io/alphaloom/)**

ブラウザーで直接お試しいただけます。

---

## 📸 スクリーンショット

> ![ダミー](assets/screenshot.png)  
>
> *ダミー*

---

## ✨ 主な機能

1. **鍵長プルダウン指定（1〜20）**
2. **列ごとの候補文字入力**（空欄は全A–Z対象／入力順で重み付け）
3. **全パターン生成と信頼度計算**
   - 列ごとの重みから尤度を算出し、上位候補を高／中／小の3グループに分類
4. **辞書による絞り込み**
   - 部分一致／完全一致の切替可能（表示は切替、内部的には両方保持）
   - 統合信頼度＝列重み＋辞書ヒットスコアで再ランキング
5. **複数辞書の管理**
   - 内蔵ミニ辞書（約200語）＋ユーザー辞書の読み込み・有効化／無効化
6. **結果のエクスポート**
   - CSV／JSON形式で出力可能

---

### 📂 ディレクトリ詳細

```
```

---

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) をご覧ください。

---

## 🛠 このツールについて

本ツールは、「生成AIで作るセキュリティツール100」プロジェクトの一環として開発されました。  
このプロジェクトでは、AIの支援を活用しながら、セキュリティに関連するさまざまなツールを  
100日間にわたり制作・公開していく取り組みを行っています。

プロジェクトの詳細や他のツールについては、以下のページをご覧ください。

🔗 [https://akademeia.info/?page_id=42163](https://akademeia.info/?page_id=42163)

