# MathQuest — 開発ルール

中学数学(1〜3年)を題材にした、シナリオつきの RPG 計算ゲーム。Chromebook のブラウザで動く Web アプリ。

## 必ず読む文書

| 文書 | 内容 |
|---|---|
| [docs/requirements.md](docs/requirements.md) | 要件定義書(承認済み)。機能番号 F○○ はここ |
| [docs/scenario.md](docs/scenario.md) | 3学年の物語の骨格。**台本と食い違う場合は台本が正** |
| [docs/setting.md](docs/setting.md) | 世界のルール・人物の口調・文体ルール。セリフを書く前に読む |
| [docs/script/](docs/script/) | 台本(1年版 全7章)。会話データはここから変換する |
| [TASKS.md](TASKS.md) | 実装タスク(縦切り)。完了したら `[x]` |

## コマンド

```bash
npm run dev        # 開発サーバー http://127.0.0.1:5173
npm test           # Vitest(tests/**/*.test.ts)
npm run typecheck  # tsc --noEmit
npm run build      # 型チェック + 本番ビルド(dist/)
```

## 技術

TypeScript + Vite + Preact。状態管理は `src/engine/store.ts` の最小ストア(依存なし)。画面遷移はシーンスタック(`src/engine/scenes.ts`)。数式表示は KaTeX(M1 で導入)。バックエンドは GAS + スプレッドシート(M3)。

本番の構成: 生徒は **GAS の Web アプリ(学校ドメイン限定)** を開く。GAS は入口ページだけを返し、ゲーム本体は GitHub Pages の `public/boot.js` が最新の `index.html` を読んで読み込む。通信は `google.script.run` → `rpc()`(`src/engine/api.ts` が自動で切り替え。開発時は fetch でモックサーバー)。生徒のデータは GitHub に送らない。素材の URL は `assetUrl()` で配信元基準に解決する。本人確認は学校の Google アカウント(GAS の `Session.getActiveUser()`)。クラス・番号は先生が `roster` シートに貼った名簿で決まり、サーバーはクライアントが送るクラス・番号を信用しない。取れない環境では合言葉方式に自動で切り替わる。授業の管理(全員をタイトルに戻す・受付停止)はスプレッドシートのメニュー → config → 応答の `session` → `src/engine/session.ts`

## ディレクトリ

```
src/
  engine/   学年に依存しないロジック(シーン・セーブ・進行・戦闘・会話)
  math/     問題テンプレート基盤・判定エンジン・SVG 描画(M1〜)
  data/     characters.ts(キャラ名の一元管理) / grade1/(章・敵・アイテム・会話データ)
  ui/       scenes/(画面) components/(部品)
  assets/   manifest.ts(素材ID → パス。なければ絵文字プレースホルダ)
tests/      Vitest
docs/       要件・シナリオ・設定・台本・モック
gas/        GAS スクリプト(M3〜)
```

## 設計原則(前回の失敗への対策)

1. **素材なしで全画面が成立する。** 画像は `<Sprite id>` 経由でのみ描く。マニフェストに path がなければ絵文字で描かれる
2. **データ駆動。** 章・ノード・敵・アイテム・会話・問題テンプレートはデータ。エンジンに固有名詞・文言を書かない。キャラ名は `src/data/characters.ts` だけ
3. **縦切り。** 「第1章が通しで遊べる」を先に作り、章を足す。壊れた状態を長く放置しない
4. **キーボードだけで戦闘が完結する。** Enter で決定、Esc で戻る
5. **学習ゲームの倫理。** 間違えても罰しない(敗北のペナルティは軽く、解説を必ず出す)。ピタの口ぐせ「まちがえたら、言い直せばいい」

## デザイン基盤(「星図と碑文」)

- トークンは `src/styles.css` の `:root` に集約(夜空の藍 × 墨 × 金箔、HP は緑青、敵は赤)。色・余白・角丸は必ず変数を使う
- 見出しは明朝(`--font-serif-jp`)+ Latin は Cinzel(同梱)、本文はゴシック(`--font-body`)。**RPG の窓(`.rpg-window`: メッセージ・コマンド・パーティ・会話)はピクセル書体 DotGothic16**(`--font-pixel`、unicode-range でサブセット配信)。長文の解説・問題文は本文書体のまま(読みやすさ優先)
- 戦闘画面は「上: メッセージ窓 / 中: 戦場(敵の真上に名前と HP) / 下: コマンド窓(▶カーソル、↑↓で移動)・問題窓・パーティ窓」の古典配置。ダメージは数字ポップ・敵のフラッシュ・画面の揺れで見せる
- 装飾は CSS だけで作る(星・角飾り・グラデ)。画像素材が入っても成立する
- 動きは `rise`(パネル出現)/`pulse`(行けるノード)/`hover`(敵)/`breathe`(立ち絵)の 4 つに限定。`html.reduce-motion` で全停止
- 入力パレットのキーには小さな説明(`caption`)を付け、入力中の内容は「こう読みます:」で数式プレビューする(上付き文字を知らなくても答えられるように)

## コーディング

- `strict` TypeScript。`any` を使わない
- コメントは日本語。「なぜ」を書く(何をしているかはコードで分かる)
- 問題テンプレートを追加したら、必ず 1000 問生成の検証テストを通す(F52)
- 会話文は台本(docs/script)から変換する。コード内に直接セリフを書かない(M0 のサンプル会話を除く)
- コミット・プッシュは指示があったときのみ
