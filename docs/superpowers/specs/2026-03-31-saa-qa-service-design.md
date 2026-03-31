# AWS SAA 一問一答サービス 設計ドキュメント

## 概要

AWS Solutions Architect Associate (SAA) 試験対策のための一問一答Webサービス。
5つの問題集（各65問）から問題を選択し、10問単位のセッションで学習する。
回答ごとに即時フィードバック（正誤 + 解説）を表示する。

## アーキテクチャ

```
[ユーザー]
    ↓
[Next.js App (Vercel)]
  ├── /           → トップ画面（問題集選択・出題開始）
  ├── /quiz       → クイズ画面（Q→A→Q→Aフロー）
  ├── /result     → セッション結果画面（10問サマリー）
  └── /history    → 学習履歴画面
    ↓ (Server Actions / API Routes)
[Supabase (PostgreSQL)]
  ├── questions   → 問題データ
  ├── sessions    → セッション管理
  └── answers     → 回答履歴
```

- **フロントエンド:** Next.js App Router (React / TypeScript)
- **バックエンド:** Next.js Server Actions
- **DB:** Supabase (PostgreSQL)
- **スタイリング:** Tailwind CSS
- **デプロイ:** Vercel

## データモデル

### questions テーブル
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
exam_set    TEXT NOT NULL          -- 問題集 ('set1'〜'set5')
body        TEXT NOT NULL          -- 問題文
option_a    TEXT NOT NULL          -- 選択肢A
option_b    TEXT NOT NULL          -- 選択肢B
option_c    TEXT NOT NULL          -- 選択肢C
option_d    TEXT NOT NULL          -- 選択肢D
answer      TEXT NOT NULL           -- 正解（単一: 'A', 複数: 'A,C' のようにカンマ区切り）
explanation TEXT NOT NULL          -- 解説
domain      TEXT                   -- 出題分野（例: S3, EC2, IAM）
created_at  TIMESTAMP DEFAULT now()
```

### sessions テーブル
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
exam_set     TEXT NOT NULL          -- 選択した問題集
start_index  INT NOT NULL           -- 開始問題番号（0, 10, 20...）
score        INT                    -- 正解数（セッション完了時に記録）
completed_at TIMESTAMP              -- 完了日時（NULL = 未完了）
created_at   TIMESTAMP DEFAULT now()
```

### answers テーブル
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
session_id   UUID REFERENCES sessions(id)
question_id  UUID REFERENCES questions(id)
selected     TEXT NOT NULL           -- ユーザーが選んだ選択肢（複数の場合は 'A,C' のようにカンマ区切り）
is_correct   BOOLEAN NOT NULL
answered_at  TIMESTAMP DEFAULT now()
```

## 画面設計

### トップ画面 (`/`)
- 問題集セレクター: Set 1〜Set 5
- セッション開始ボタン（開始問題番号も選択可: 問1〜10, 問11〜20...）
- 総学習サマリー: 総回答数・全体正答率
- 問題集ごとの正答率サマリー

### クイズ画面 (`/quiz`)
- セッション内の進捗表示（例: 3/10）
- 問題文表示
- **回答前:** 単一正解問題はラジオボタン、複数正解問題はチェックボックス（問題文に「2つ選べ」等を明示）+ 回答ボタン
- **回答後:** 正解選択肢をハイライト（緑）・不正解選択肢をハイライト（赤）+ 解説テキスト表示 + 「次の問題へ」ボタン
- 10問完了でセッション結果画面へ自動遷移

### 結果画面 (`/result/[set]`)
- Set 1〜Set 5 それぞれ独立したページ（例: `/result/set1`）
- 1ページに1〜65問の全問を表示した正誤マトリクス表:
  - 縦軸: 問題NO（問1〜問65）
  - 横軸: 挑戦回数（1回目・2回目・3回目...）
  - セル: 選んだ選択肢（A/B/C/D）を表示、緑背景（正解）/ 赤背景（不正解）/ 空白（未挑戦）
- 問題NOをクリックすると問題文・正解・解説を確認できる
- Set切り替えタブ or リンクで別Setの結果に移動できる

### 履歴画面 (`/history`)
- 直近のセッション一覧（問題集・範囲・スコア・日時）
- 問題集別正答率の棒グラフ（シンプルなCSS実装）

## 問題データのインポート

ユーザーがClaudeに問題文を貼り付け → ClaudeがJSONを生成・保存 → スクリプトでSupabaseに同期する。

**ワークフロー:**
1. ユーザーがClaudeに問題文を貼り付ける
2. ClaudeがJSONを解析・解説生成して `data/set{N}/q{番号}.json` に保存
3. 同期スクリプトを実行してSupabaseにupsert

**JSONフォーマット (`data/set1/q50.json`):**
```json
{
  "exam_set": "set1",
  "order": 50,
  "body": "問題文...",
  "option_a": "選択肢A",
  "option_b": "選択肢B",
  "option_c": "選択肢C",
  "option_d": "選択肢D",
  "answer": "D",
  "domain": "S3",
  "explanation": {
    "key_conditions": "問題文から読み取るべき前提",
    "what_is_asked": "設問の核心",
    "decision_axis": "可用性 / コスト / パフォーマンス / セキュリティ など",
    "keywords": [
      { "keyword": "キーワード", "pattern": "正解/誤り", "reason": "理由" }
    ],
    "options_analysis": [
      { "option": "A", "text": "選択肢文", "is_correct": false, "reason": "理由" }
    ],
    "essence": "この問題の本質を一行で"
  }
}
```

**同期コマンド:**
```bash
npx ts-node scripts/sync.ts
# data/ 以下の全JSONをSupabaseにupsert（order + exam_setをキーに重複排除）
```

## 出題ロジック

- 1セッション = 10問
- 65問 → 7セッション（1〜60問の6セット + 残り5問の1セット）
- セッション開始時に対象問題をSupabaseからフェッチしてクライアントに渡す
- 出題順は問題集の順番通り（ランダム化はMVP対象外）

## MVP対象外（将来対応）

- 苦手問題フィルター（正答率の低い問題を優先出題）
- マルチユーザー対応（ログイン・認証）
- 問題のランダム順出題
- 管理画面からの問題登録

## ディレクトリ構成（想定）

```
saa_questions/
├── src/
│   └── app/
│       ├── page.tsx            # トップ画面
│       ├── quiz/
│       │   └── page.tsx        # クイズ画面
│       ├── result/
│       │   └── page.tsx        # セッション結果画面
│       ├── history/
│       │   └── page.tsx        # 履歴画面
│       └── actions/
│           ├── questions.ts    # 問題取得
│           └── sessions.ts     # セッション・回答記録
├── scripts/
│   └── sync.ts                 # JSONをSupabaseに同期するスクリプト
├── data/
│   ├── set1/
│   │   ├── q1.json
│   │   └── q2.json
│   ├── set2/
│   ├── set3/
│   ├── set4/
│   └── set5/
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-03-31-saa-qa-service-design.md
```
