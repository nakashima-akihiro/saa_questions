# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # 開発サーバー起動 (http://localhost:3000)
npm run build     # プロダクションビルド
npm run lint      # ESLint
npm run sync      # data/ のJSONをSupabaseに同期（tsx scripts/sync.ts）
```

## Architecture

AWS SAA試験対策の一問一答WebサービスをNext.js App Router + Supabaseで構築。

### データフロー

1. **問題データ**: `data/set1/` 〜 `data/set5/` に1問1JSONファイルで保存
2. **同期**: `npm run sync` でJSONをSupabase `questions` テーブルにupsert
3. **Web**: Next.js Server ActionsがSupabaseを読み書き、クライアントに返す

### ページ構成

- `/` — トップ画面。Set別正答率と出題開始リンク（`?set=set1&start=0` 形式）
- `/quiz?set=set1&start=0` — クイズ画面。Server Componentがセッション作成・問題取得、`QuizClient.tsx`がQ→A→Qフローを管理
- `/result/[set]` — 結果画面。全問題×挑戦回数のマトリクス表示
- `/history` — 履歴画面。Set別正答率バーグラフと直近セッション一覧

### Server Actions (`src/app/actions/`)

- `questions.ts` — `getQuestions`, `getQuestionStats`, `getAllSetStats`
- `sessions.ts` — `createSession`, `recordAnswer`, `completeSession`, `getRecentSessions`

### Supabaseテーブル

- `questions` — 問題データ（`exam_set` + `order` がユニークキー）
- `sessions` — クイズセッション（10問単位）
- `answers` — 各問への回答（セッション・問題への外部キー）

### JSONフォーマット（`data/set*/q*.json`）

```json
{
  "exam_set": "set1",
  "order": 1,
  "body": "問題文",
  "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...",
  "answer": "B",
  "domain": "S3",
  "explanation": {
    "key_conditions": "...",
    "what_is_asked": "...",
    "decision_axis": "...",
    "keywords": [{ "keyword": "...", "pattern": "正解|誤り", "reason": "..." }],
    "options_analysis": [{ "option": "A", "text": "...", "is_correct": false, "reason": "..." }],
    "essence": "..."
  }
}
```

`answer` は複数正解の場合 `"A,C"` のようにカンマ区切り。`exam_set` + `order` がユニークキーのためupsertで上書き可能。

## 問題データの登録ワークフロー

ユーザーが問題文・選択肢・正解を貼り付けたら、以下のルールでJSONファイルを作成する。

### ファイルの配置ルール

- **set番号**: 直近の会話でユーザーが指定したset番号のディレクトリに配置する（例: 「set2に入れて」と言われていたら `data/set2/`）
- **ファイル名**: 貼り付けテキスト中の「問題1」「問題2」などの番号を使い `q1.json` `q2.json` とする

### explanationの構成

explanation の各フィールドは以下の内容で埋める：

- `key_conditions` — 問題文から読み取るべき前提・制約条件
- `what_is_asked` — 設問の核心（何を選ぶべきか）
- `decision_axis` — 判断の軸（可用性 / コスト / 運用オーバーヘッド / セキュリティ 等）
- `keywords` — 問題文中の言葉を見たときに反射的に頭に浮かべるべき回答キーワード。「この言葉が出たらこのサービス/パターンを思い浮かべる」という連想マップとして記述する。`pattern` は `"正解"` または `"誤り"`
- `options_analysis` — 各選択肢の正誤と理由を表形式で
- `essence` — この問題で覚えるべき本質を一行で

### 入力フォーマットの読み取り方

貼り付けテキストは以下の形式で来る。「正解」ラベルが付いた選択肢が正答。選択肢の順序（A/B/C/D）は登場順に割り当てる。

```
問題N:
（問題文）

正解
（選択肢テキスト）  ← answer: "A"

（選択肢テキスト）
（選択肢テキスト）
（選択肢テキスト）
```

作成後は `npm run sync` でSupabaseに同期する。

## 環境変数 (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://cvtrwkzhkdkupkhyqprs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # Webアプリ用
SUPABASE_SERVICE_ROLE_KEY=...       # sync.ts用
```
