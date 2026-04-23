# 六華（リッカ）オンライン対戦

麻雀の体験をシンプルに再構築したボードゲーム「六華」のオンライン対戦実装です。

## 🎆 ゲームルール

### 概要
- プレイ人数：2〜5人
- 目標：10点を先取したプレイヤーが勝利

### 牌について
リッカ牌はドミノ牌で、上下に1〜6のシンボルが描かれています。
手牌の「上」の面を使って役を作りますが、牌を**反転**させると上下が入れ替わります。

### 手番の流れ
1. 場の牌を1枚選んで引く（裏向き山札 or 表向き場から）
2. 手牌6枚から不要な1枚を捨てる（表向きで場に置く）
3. 役が完成したら「上がる！」を宣言

### 役の種類（基本）
| 役名 | 条件 | 点数 |
|------|------|------|
| 六華 | 6枚全て同じ数字 | 6点 |
| 三連 | 3連続の数字×2組 | 3点 |
| 一色 | 上か下が全部同じ数字 | 2点 |

### ついでに完成
誰かが上がった後、「あと1枚で完成できた人」が場に表向きの牌を使って完成できる場合、得点を受け取れます。

---

## 🚀 セットアップ

### 必要環境
- Node.js 18以上

### インストール
```bash
npm install
```

### ローカル起動
```bash
npm start
```
ブラウザで `http://localhost:3000` を開いてください。

---

## 🌐 デプロイ（GitHub + Render.com）

### 1. GitHubにプッシュ
```bash
git init
git add .
git commit -m "Initial commit: 六華オンライン対戦"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/rikka-online.git
git push -u origin main
```

### 2. Render.comでデプロイ
1. [render.com](https://render.com) にアクセスしてアカウント作成
2. 「New Web Service」をクリック
3. GitHubリポジトリを接続
4. 以下の設定を入力：
   - **Name**: `rikka-online`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. 「Create Web Service」をクリック

Renderの無料プランで動作します！デプロイ後、自動でURLが発行されます。

### 3. 友達と遊ぶ
- デプロイされたURLをブラウザで開く
- ルームIDを決めて友達に共有
- 2〜5人でプレイ可能！

---

## ♻️ 他のデプロイ先

### Railway
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Fly.io
```bash
fly launch
fly deploy
```

---

## 📁 ファイル構成

```
rikka-online/
├── server.js      # WebSocketサーバー（ゲームロジック）
├── index.html     # フロントエンド（UI + クライアントロジック）
├── package.json   # 依存パッケージ
└── README.md      # このファイル
```

---

## 🔧 カスタマイズ

### 追加ルールの実装
`server.js` の `checkWin` 関数に追加ルールを追加できます：
- **無双**（6枚全て異なる数字）など

### スコア目標の変更
`server.js` の `player.score >= 10` の `10` を変更

---

*ゲームデザイン：橋本淳志（アークライト）/ 原案：尾根ギア、野澤邦仁（アークライト）*  
*このオンライン実装は個人的な学習・プレイ用途のファンプロジェクトです*
