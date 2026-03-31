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

## 環境変数 (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://cvtrwkzhkdkupkhyqprs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # Webアプリ用
SUPABASE_SERVICE_ROLE_KEY=...       # sync.ts用
```
