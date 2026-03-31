# AWS SAA 一問一答サービス Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AWS SAA試験対策のための一問一答WebサービスをNext.js + Supabaseで構築し、Vercelにデプロイする。

**Architecture:** Next.js App Router (TypeScript) + Supabase (PostgreSQL)。問題データはClaudeがJSON生成しプロジェクト内に保存、syncスクリプトでSupabaseに同期。クイズはQ→A→Q→Aフローで10問セッション単位、結果画面はSetごとに全65問の正誤マトリクスを表示する。

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL + @supabase/supabase-js), ts-node, Vercel

---

## ファイル構成

```
saa_questions/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # ルートレイアウト
│   │   ├── page.tsx                      # トップ画面
│   │   ├── quiz/
│   │   │   └── page.tsx                  # クイズ画面
│   │   ├── result/
│   │   │   └── [set]/
│   │   │       └── page.tsx              # 結果画面（Setごと）
│   │   ├── history/
│   │   │   └── page.tsx                  # 履歴画面
│   │   └── actions/
│   │       ├── questions.ts              # 問題取得 Server Actions
│   │       └── sessions.ts              # セッション・回答記録 Server Actions
│   ├── lib/
│   │   └── supabase.ts                  # Supabaseクライアント
│   └── types/
│       └── index.ts                     # 共通型定義
├── scripts/
│   └── sync.ts                          # JSONをSupabaseに同期
├── data/
│   ├── set1/                            # 問題JSONファイル群
│   ├── set2/
│   ├── set3/
│   ├── set4/
│   └── set5/
└── supabase/
    └── schema.sql                       # DBスキーマ
```

---

## Task 1: プロジェクトセットアップ

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`
- Create: `.env.local` (gitignore済み)
- Create: `.gitignore`

- [ ] **Step 1: Next.jsプロジェクトを初期化**

```bash
cd /Users/akihiro.nakashima/dev/practice/saa_questions
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

プロンプトが出たら全てデフォルト（Enter）を選択。

- [ ] **Step 2: 依存パッケージを追加インストール**

```bash
npm install @supabase/supabase-js
npm install --save-dev ts-node @types/node
```

- [ ] **Step 3: `.env.local` を作成**

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
EOF
```

Supabaseプロジェクト作成後に実際の値に置き換える。

- [ ] **Step 4: `.gitignore` に追記**

`.gitignore` を開き、以下が含まれていることを確認（create-next-appで自動生成済みのはずだが念のため）:
```
.env.local
.env*.local
```

- [ ] **Step 5: 開発サーバーが起動することを確認**

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開き、Next.jsのデフォルトページが表示されればOK。Ctrl+Cで停止。

- [ ] **Step 6: 初回コミット**

```bash
git init
git add -A
git commit -m "chore: initialize Next.js project with Tailwind and Supabase"
```

---

## Task 2: Supabaseセットアップ & DBスキーマ

**Files:**
- Create: `supabase/schema.sql`
- Create: `src/lib/supabase.ts`
- Create: `src/types/index.ts`

- [ ] **Step 1: Supabaseプロジェクトを作成**

1. https://supabase.com にアクセスしてログイン
2. 「New project」でプロジェクトを作成
3. Project Settings → API から以下をコピー:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
4. `.env.local` の値を置き換える

- [ ] **Step 2: `supabase/schema.sql` を作成**

```sql
-- questions テーブル
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_set TEXT NOT NULL,
  "order" INT NOT NULL,
  body TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  answer TEXT NOT NULL,
  explanation JSONB NOT NULL,
  domain TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (exam_set, "order")
);

-- sessions テーブル
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_set TEXT NOT NULL,
  start_index INT NOT NULL,
  score INT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- answers テーブル
CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  selected TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_questions_exam_set ON questions(exam_set, "order");
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_session_id ON answers(session_id);
```

- [ ] **Step 3: SupabaseのSQL Editorでスキーマを実行**

1. Supabaseダッシュボード → SQL Editor
2. `supabase/schema.sql` の内容を貼り付けて実行
3. Table Editorで3つのテーブルが作成されていることを確認

- [ ] **Step 4: `src/lib/supabase.ts` を作成**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// サーバーサイド（Server Actions / scripts）用
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 5: `src/types/index.ts` を作成**

```typescript
export type ExamSet = 'set1' | 'set2' | 'set3' | 'set4' | 'set5'

export type Keyword = {
  keyword: string
  pattern: '正解' | '誤り'
  reason: string
}

export type OptionAnalysis = {
  option: 'A' | 'B' | 'C' | 'D'
  text: string
  is_correct: boolean
  reason: string
}

export type Explanation = {
  key_conditions: string
  what_is_asked: string
  decision_axis: string
  keywords: Keyword[]
  options_analysis: OptionAnalysis[]
  essence: string
}

export type Question = {
  id: string
  exam_set: ExamSet
  order: number
  body: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  answer: string   // 'A' | 'B' | 'C' | 'D' | 'A,C' など
  explanation: Explanation
  domain: string | null
  created_at: string
}

export type Session = {
  id: string
  exam_set: ExamSet
  start_index: number
  score: number | null
  completed_at: string | null
  created_at: string
}

export type Answer = {
  id: string
  session_id: string
  question_id: string
  selected: string
  is_correct: boolean
  answered_at: string
}

// クイズ画面で使うセッション状態
export type QuizState = {
  session: Session
  questions: Question[]
  currentIndex: number   // 0-9
  answers: Answer[]
}
```

- [ ] **Step 6: コミット**

```bash
git add supabase/schema.sql src/lib/supabase.ts src/types/index.ts
git commit -m "feat: add Supabase schema and type definitions"
```

---

## Task 3: JSONデータ同期スクリプト

**Files:**
- Create: `scripts/sync.ts`
- Create: `data/set1/.gitkeep` (ディレクトリ保持用)

- [ ] **Step 1: `data/` ディレクトリ構造を作成**

```bash
mkdir -p data/set1 data/set2 data/set3 data/set4 data/set5
touch data/set1/.gitkeep data/set2/.gitkeep data/set3/.gitkeep data/set4/.gitkeep data/set5/.gitkeep
```

- [ ] **Step 2: `scripts/sync.ts` を作成**

```typescript
import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// .env.local を読み込む
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length > 0) {
      process.env[key.trim()] = rest.join('=').trim()
    }
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function syncAll() {
  const dataDir = path.join(process.cwd(), 'data')
  const sets = ['set1', 'set2', 'set3', 'set4', 'set5']
  let totalUpserted = 0
  let totalErrors = 0

  for (const set of sets) {
    const setDir = path.join(dataDir, set)
    if (!fs.existsSync(setDir)) continue

    const files = fs.readdirSync(setDir).filter(f => f.endsWith('.json'))
    if (files.length === 0) continue

    console.log(`\n[${set}] ${files.length}件のJSONを処理中...`)

    for (const file of files) {
      const filePath = path.join(setDir, file)
      const raw = fs.readFileSync(filePath, 'utf-8')
      let data: Record<string, unknown>

      try {
        data = JSON.parse(raw)
      } catch {
        console.error(`  ✗ パースエラー: ${file}`)
        totalErrors++
        continue
      }

      const { error } = await supabase
        .from('questions')
        .upsert(
          {
            exam_set: data.exam_set,
            order: data.order,
            body: data.body,
            option_a: data.option_a,
            option_b: data.option_b,
            option_c: data.option_c,
            option_d: data.option_d,
            answer: data.answer,
            explanation: data.explanation,
            domain: data.domain ?? null,
          },
          { onConflict: 'exam_set,order' }
        )

      if (error) {
        console.error(`  ✗ ${file}: ${error.message}`)
        totalErrors++
      } else {
        console.log(`  ✓ ${file}`)
        totalUpserted++
      }
    }
  }

  console.log(`\n完了: ${totalUpserted}件成功, ${totalErrors}件エラー`)
}

syncAll().catch(console.error)
```

- [ ] **Step 3: `tsconfig.json` にscriptsを含める設定を確認**

`tsconfig.json` を開き `include` に `"scripts"` が含まれているか確認。なければ追加:
```json
{
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", "scripts/**/*.ts"]
}
```

- [ ] **Step 4: テスト用JSONを1件作成して動作確認**

`data/set1/q1.json` を作成:
```json
{
  "exam_set": "set1",
  "order": 1,
  "body": "テスト問題です。AWSのオブジェクトストレージサービスはどれですか？",
  "option_a": "EC2",
  "option_b": "S3",
  "option_c": "RDS",
  "option_d": "Lambda",
  "answer": "B",
  "domain": "S3",
  "explanation": {
    "key_conditions": "オブジェクトストレージサービスを問う",
    "what_is_asked": "AWSのオブジェクトストレージサービス",
    "decision_axis": "AWSサービスの基本知識",
    "keywords": [
      { "keyword": "オブジェクトストレージ", "pattern": "正解", "reason": "S3はオブジェクトストレージサービス" }
    ],
    "options_analysis": [
      { "option": "A", "text": "EC2", "is_correct": false, "reason": "EC2はコンピューティングサービス" },
      { "option": "B", "text": "S3", "is_correct": true, "reason": "S3はSimple Storage Serviceでオブジェクトストレージ" },
      { "option": "C", "text": "RDS", "is_correct": false, "reason": "RDSはリレーショナルDBサービス" },
      { "option": "D", "text": "Lambda", "is_correct": false, "reason": "Lambdaはサーバーレス関数実行サービス" }
    ],
    "essence": "S3がAWSの代表的なオブジェクトストレージであることを覚える"
  }
}
```

- [ ] **Step 5: 同期スクリプトを実行して確認**

```bash
npx ts-node --project tsconfig.json scripts/sync.ts
```

期待する出力:
```
[set1] 1件のJSONを処理中...
  ✓ q1.json

完了: 1件成功, 0件エラー
```

Supabaseダッシュボード → Table Editor → questions でレコードが1件入っていることを確認。

- [ ] **Step 6: コミット**

```bash
git add scripts/sync.ts data/set1/.gitkeep data/set2/.gitkeep data/set3/.gitkeep data/set4/.gitkeep data/set5/.gitkeep data/set1/q1.json
git commit -m "feat: add JSON sync script and sample question"
```

---

## Task 4: Server Actions（問題取得・セッション管理）

**Files:**
- Create: `src/app/actions/questions.ts`
- Create: `src/app/actions/sessions.ts`

- [ ] **Step 1: `src/app/actions/questions.ts` を作成**

```typescript
'use server'

import { supabase } from '@/lib/supabase'
import type { Question, ExamSet } from '@/types'

export async function getQuestions(
  examSet: ExamSet,
  startIndex: number,
  limit: number = 10
): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('exam_set', examSet)
    .order('order', { ascending: true })
    .range(startIndex, startIndex + limit - 1)

  if (error) throw new Error(error.message)
  return data as Question[]
}

export async function getQuestionStats(examSet: ExamSet): Promise<{
  order: number
  totalAttempts: number
  correctCount: number
  history: { attempt: number; selected: string; is_correct: boolean }[]
}[]> {
  // 問題ごとの回答履歴を集計（結果画面マトリクス用）
  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('id, order')
    .eq('exam_set', examSet)
    .order('order', { ascending: true })

  if (qErr) throw new Error(qErr.message)

  const result = []
  for (const q of questions) {
    const { data: answers, error: aErr } = await supabase
      .from('answers')
      .select('selected, is_correct, answered_at')
      .eq('question_id', q.id)
      .order('answered_at', { ascending: true })

    if (aErr) throw new Error(aErr.message)

    result.push({
      order: q.order,
      totalAttempts: answers.length,
      correctCount: answers.filter(a => a.is_correct).length,
      history: answers.map((a, i) => ({
        attempt: i + 1,
        selected: a.selected,
        is_correct: a.is_correct,
      })),
    })
  }
  return result
}

export async function getAllSetStats(): Promise<{
  examSet: ExamSet
  totalAnswered: number
  correctCount: number
}[]> {
  const sets: ExamSet[] = ['set1', 'set2', 'set3', 'set4', 'set5']
  const result = []

  for (const examSet of sets) {
    const { data: questions } = await supabase
      .from('questions')
      .select('id')
      .eq('exam_set', examSet)

    if (!questions || questions.length === 0) {
      result.push({ examSet, totalAnswered: 0, correctCount: 0 })
      continue
    }

    const questionIds = questions.map(q => q.id)
    const { data: answers } = await supabase
      .from('answers')
      .select('is_correct')
      .in('question_id', questionIds)

    result.push({
      examSet,
      totalAnswered: answers?.length ?? 0,
      correctCount: answers?.filter(a => a.is_correct).length ?? 0,
    })
  }
  return result
}
```

- [ ] **Step 2: `src/app/actions/sessions.ts` を作成**

```typescript
'use server'

import { supabase } from '@/lib/supabase'
import type { ExamSet, Session, Answer } from '@/types'

export async function createSession(
  examSet: ExamSet,
  startIndex: number
): Promise<Session> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ exam_set: examSet, start_index: startIndex })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Session
}

export async function recordAnswer(
  sessionId: string,
  questionId: string,
  selected: string,
  isCorrect: boolean
): Promise<Answer> {
  const { data, error } = await supabase
    .from('answers')
    .insert({
      session_id: sessionId,
      question_id: questionId,
      selected,
      is_correct: isCorrect,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Answer
}

export async function completeSession(
  sessionId: string,
  score: number
): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ score, completed_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)
}

export async function getRecentSessions(limit: number = 20): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return data as Session[]
}
```

- [ ] **Step 3: コミット**

```bash
git add src/app/actions/questions.ts src/app/actions/sessions.ts
git commit -m "feat: add Server Actions for questions and sessions"
```

---

## Task 5: トップ画面

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/layout.tsx` (既存を修正)

- [ ] **Step 1: `src/app/layout.tsx` をシンプルなレイアウトに修正**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AWS SAA 一問一答',
  description: 'AWS Solutions Architect Associate 試験対策',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="bg-white border-b border-gray-200 px-4 py-3">
          <nav className="max-w-4xl mx-auto flex gap-6">
            <a href="/" className="font-bold text-blue-600">AWS SAA 一問一答</a>
            <a href="/history" className="text-gray-600 hover:text-gray-900">履歴</a>
            <a href="/result/set1" className="text-gray-600 hover:text-gray-900">結果</a>
          </nav>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: `src/app/page.tsx` を作成**

```tsx
import Link from 'next/link'
import { getAllSetStats } from './actions/questions'
import type { ExamSet } from '@/types'

const SET_LABELS: Record<ExamSet, string> = {
  set1: 'Set 1',
  set2: 'Set 2',
  set3: 'Set 3',
  set4: 'Set 4',
  set5: 'Set 5',
}

const SESSION_RANGES = [
  { label: '問1〜10', startIndex: 0 },
  { label: '問11〜20', startIndex: 10 },
  { label: '問21〜30', startIndex: 20 },
  { label: '問31〜40', startIndex: 30 },
  { label: '問41〜50', startIndex: 40 },
  { label: '問51〜60', startIndex: 50 },
  { label: '問61〜65', startIndex: 60 },
]

export default async function HomePage() {
  const stats = await getAllSetStats()
  const totalAnswered = stats.reduce((s, x) => s + x.totalAnswered, 0)
  const totalCorrect = stats.reduce((s, x) => s + x.correctCount, 0)
  const overallRate = totalAnswered > 0
    ? Math.round((totalCorrect / totalAnswered) * 100)
    : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">AWS SAA 一問一答</h1>
        <p className="text-gray-500">
          総回答数: {totalAnswered}問 / 全体正答率: {overallRate}%
        </p>
      </div>

      {/* 問題集ごとの正答率 */}
      <div>
        <h2 className="text-lg font-semibold mb-3">問題集別 正答率</h2>
        <div className="grid grid-cols-5 gap-3">
          {stats.map(({ examSet, totalAnswered: ta, correctCount }) => {
            const rate = ta > 0 ? Math.round((correctCount / ta) * 100) : 0
            return (
              <div key={examSet} className="bg-white rounded-lg border p-3 text-center">
                <div className="text-sm text-gray-500">{SET_LABELS[examSet]}</div>
                <div className="text-xl font-bold mt-1">{rate}%</div>
                <div className="text-xs text-gray-400">{ta}問回答</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 出題開始 */}
      <div>
        <h2 className="text-lg font-semibold mb-3">出題開始</h2>
        <div className="space-y-4">
          {(['set1', 'set2', 'set3', 'set4', 'set5'] as ExamSet[]).map(set => (
            <div key={set} className="bg-white rounded-lg border p-4">
              <h3 className="font-medium mb-3">{SET_LABELS[set]}</h3>
              <div className="flex flex-wrap gap-2">
                {SESSION_RANGES.map(({ label, startIndex }) => (
                  <Link
                    key={startIndex}
                    href={`/quiz?set=${set}&start=${startIndex}`}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 開発サーバーで表示確認**

```bash
npm run dev
```

http://localhost:3000 を開き、問題集選択UI・正答率サマリーが表示されることを確認。Ctrl+Cで停止。

- [ ] **Step 4: コミット**

```bash
git add src/app/layout.tsx src/app/page.tsx
git commit -m "feat: add top page with set selector and stats"
```

---

## Task 6: クイズ画面

**Files:**
- Create: `src/app/quiz/page.tsx`
- Create: `src/app/quiz/QuizClient.tsx`

- [ ] **Step 1: `src/app/quiz/page.tsx` を作成（Server Component）**

```tsx
import { redirect } from 'next/navigation'
import { getQuestions } from '../actions/questions'
import { createSession } from '../actions/sessions'
import QuizClient from './QuizClient'
import type { ExamSet } from '@/types'

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string; start?: string }>
}) {
  const params = await searchParams
  const examSet = (params.set ?? 'set1') as ExamSet
  const startIndex = parseInt(params.start ?? '0', 10)

  const questions = await getQuestions(examSet, startIndex, 10)
  if (questions.length === 0) redirect('/')

  const session = await createSession(examSet, startIndex)

  return <QuizClient session={session} questions={questions} />
}
```

- [ ] **Step 2: `src/app/quiz/QuizClient.tsx` を作成（Client Component）**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { recordAnswer, completeSession } from '../actions/sessions'
import type { Question, Session } from '@/types'

type Props = {
  session: Session
  questions: Question[]
}

function isMultipleAnswer(answer: string) {
  return answer.includes(',')
}

function checkCorrect(answer: string, selected: string[]): boolean {
  const correctSet = new Set(answer.split(',').map(s => s.trim()))
  const selectedSet = new Set(selected)
  if (correctSet.size !== selectedSet.size) return false
  for (const a of correctSet) {
    if (!selectedSet.has(a)) return false
  }
  return true
}

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const

export default function QuizClient({ session, questions }: Props) {
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)

  const question = questions[currentIndex]
  const isMultiple = isMultipleAnswer(question.answer)
  const options = {
    A: question.option_a,
    B: question.option_b,
    C: question.option_c,
    D: question.option_d,
  }
  const correctAnswers = question.answer.split(',').map(s => s.trim())

  function toggleOption(key: string) {
    if (answered) return
    if (isMultiple) {
      setSelected(prev =>
        prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      )
    } else {
      setSelected([key])
    }
  }

  async function handleAnswer() {
    if (selected.length === 0) return
    const correct = checkCorrect(question.answer, selected)
    if (correct) setScore(s => s + 1)
    await recordAnswer(session.id, question.id, selected.join(','), correct)
    setAnswered(true)
  }

  async function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1)
      setSelected([])
      setAnswered(false)
    } else {
      await completeSession(session.id, score + (checkCorrect(question.answer, selected) ? 1 : 0))
      router.push(`/result/${session.exam_set}`)
    }
  }

  function getOptionStyle(key: string): string {
    const base = 'w-full text-left p-3 rounded-lg border-2 transition-colors '
    if (!answered) {
      return base + (selected.includes(key)
        ? 'border-blue-500 bg-blue-50'
        : 'border-gray-200 hover:border-gray-300')
    }
    if (correctAnswers.includes(key)) return base + 'border-green-500 bg-green-50'
    if (selected.includes(key) && !correctAnswers.includes(key)) return base + 'border-red-500 bg-red-50'
    return base + 'border-gray-200 bg-gray-50'
  }

  return (
    <div className="space-y-6">
      {/* 進捗 */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{currentIndex + 1} / {questions.length}</span>
        <span>{session.exam_set.toUpperCase()} 問{session.start_index + currentIndex + 1}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full">
        <div
          className="h-2 bg-blue-600 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* 問題文 */}
      <div className="bg-white rounded-lg border p-6">
        {isMultiple && (
          <p className="text-sm font-medium text-blue-600 mb-2">※ 2つ以上選んでください</p>
        )}
        <p className="text-base leading-relaxed whitespace-pre-wrap">{question.body}</p>
      </div>

      {/* 選択肢 */}
      <div className="space-y-2">
        {OPTION_KEYS.map(key => (
          <button
            key={key}
            onClick={() => toggleOption(key)}
            className={getOptionStyle(key)}
            disabled={answered}
          >
            <span className="font-bold mr-2">{key}.</span>
            {options[key]}
          </button>
        ))}
      </div>

      {/* 解説（回答後） */}
      {answered && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <p className="font-bold text-lg">
            {checkCorrect(question.answer, selected) ? '✓ 正解' : '✗ 不正解'}
            　正解: {question.answer}
          </p>

          <div className="space-y-3 text-sm">
            <div>
              <span className="font-semibold">重要条件:</span>
              <p className="mt-1 text-gray-700">{question.explanation.key_conditions}</p>
            </div>
            <div>
              <span className="font-semibold">問われていること:</span>
              <p className="mt-1 text-gray-700">{question.explanation.what_is_asked}</p>
            </div>
            <div>
              <span className="font-semibold">判断軸:</span>
              <p className="mt-1 text-gray-700">{question.explanation.decision_axis}</p>
            </div>

            {/* キーワード表 */}
            <div>
              <span className="font-semibold">キーワード:</span>
              <table className="mt-2 w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left">キーワード</th>
                    <th className="border p-2 text-left">パターン</th>
                    <th className="border p-2 text-left">理由</th>
                  </tr>
                </thead>
                <tbody>
                  {question.explanation.keywords.map((kw, i) => (
                    <tr key={i}>
                      <td className="border p-2">{kw.keyword}</td>
                      <td className={`border p-2 font-medium ${kw.pattern === '正解' ? 'text-green-700' : 'text-red-700'}`}>
                        {kw.pattern}
                      </td>
                      <td className="border p-2 text-gray-600">{kw.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 選択肢分析表 */}
            <div>
              <span className="font-semibold">選択肢の正誤ポイント:</span>
              <table className="mt-2 w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2">選択肢</th>
                    <th className="border p-2 text-left">内容</th>
                    <th className="border p-2">正誤</th>
                    <th className="border p-2 text-left">理由</th>
                  </tr>
                </thead>
                <tbody>
                  {question.explanation.options_analysis.map((opt, i) => (
                    <tr key={i}>
                      <td className="border p-2 text-center font-bold">{opt.option}</td>
                      <td className="border p-2 text-gray-700">{opt.text}</td>
                      <td className={`border p-2 text-center font-medium ${opt.is_correct ? 'text-green-700' : 'text-red-700'}`}>
                        {opt.is_correct ? '正解' : '不正解'}
                      </td>
                      <td className="border p-2 text-gray-600">{opt.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <span className="font-semibold">この問題の本質:</span>
              <p className="mt-1 text-gray-700">{question.explanation.essence}</p>
            </div>
          </div>
        </div>
      )}

      {/* ボタン */}
      <div className="flex gap-3">
        {!answered ? (
          <button
            onClick={handleAnswer}
            disabled={selected.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            回答する
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            {currentIndex < questions.length - 1 ? '次の問題へ →' : '結果を見る'}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 開発サーバーで動作確認**

```bash
npm run dev
```

1. http://localhost:3000 でSet1・問1〜10のリンクをクリック
2. 問題が表示されること
3. 選択肢を選んで「回答する」を押すと正誤フィードバックと解説が表示されること
4. 「次の問題へ」で進めること
5. 10問終わったら `/result/set1` にリダイレクトされること（まだ404でよい）

Ctrl+Cで停止。

- [ ] **Step 4: コミット**

```bash
git add src/app/quiz/page.tsx src/app/quiz/QuizClient.tsx
git commit -m "feat: add quiz page with Q→A→Q flow and explanation display"
```

---

## Task 7: 結果画面

**Files:**
- Create: `src/app/result/[set]/page.tsx`

- [ ] **Step 1: `src/app/result/[set]/page.tsx` を作成**

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getQuestionStats } from '../../actions/questions'
import type { ExamSet } from '@/types'

const SETS: ExamSet[] = ['set1', 'set2', 'set3', 'set4', 'set5']
const SET_LABELS: Record<ExamSet, string> = {
  set1: 'Set 1', set2: 'Set 2', set3: 'Set 3', set4: 'Set 4', set5: 'Set 5',
}

export default async function ResultPage({
  params,
}: {
  params: Promise<{ set: string }>
}) {
  const { set } = await params
  if (!SETS.includes(set as ExamSet)) redirect('/result/set1')
  const examSet = set as ExamSet

  const stats = await getQuestionStats(examSet)
  const maxAttempts = Math.max(...stats.map(s => s.totalAttempts), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">結果</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">← トップへ</Link>
      </div>

      {/* Set切り替えタブ */}
      <div className="flex gap-2 border-b border-gray-200">
        {SETS.map(s => (
          <Link
            key={s}
            href={`/result/${s}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              s === examSet
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {SET_LABELS[s]}
          </Link>
        ))}
      </div>

      {stats.length === 0 ? (
        <p className="text-gray-500">このSetにはまだ問題がありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse min-w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left sticky left-0 bg-gray-100 z-10">
                  問題No.
                </th>
                {Array.from({ length: maxAttempts }, (_, i) => (
                  <th key={i} className="border border-gray-300 p-2 text-center min-w-[60px]">
                    {i + 1}回目
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map(({ order, history }) => (
                <tr key={order} className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-2 font-medium sticky left-0 bg-white z-10">
                    問{order}
                  </td>
                  {Array.from({ length: maxAttempts }, (_, i) => {
                    const attempt = history[i]
                    if (!attempt) {
                      return (
                        <td key={i} className="border border-gray-300 p-2 text-center text-gray-300">
                          -
                        </td>
                      )
                    }
                    return (
                      <td
                        key={i}
                        className={`border border-gray-300 p-2 text-center font-bold ${
                          attempt.is_correct
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {attempt.selected}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 開発サーバーで動作確認**

```bash
npm run dev
```

1. http://localhost:3000/result/set1 を開く
2. 問題NOのリスト・挑戦回数の列が表示されること
3. 回答済みセルが緑（正解）/ 赤（不正解）/ `-`（未挑戦）で表示されること
4. Set2〜Set5タブで切り替えができること

Ctrl+Cで停止。

- [ ] **Step 3: コミット**

```bash
git add src/app/result/[set]/page.tsx
git commit -m "feat: add result page with per-question attempt matrix"
```

---

## Task 8: 履歴画面

**Files:**
- Create: `src/app/history/page.tsx`

- [ ] **Step 1: `src/app/history/page.tsx` を作成**

```tsx
import Link from 'next/link'
import { getRecentSessions } from '../actions/sessions'
import { getAllSetStats } from '../actions/questions'
import type { ExamSet } from '@/types'

const SET_LABELS: Record<ExamSet, string> = {
  set1: 'Set 1', set2: 'Set 2', set3: 'Set 3', set4: 'Set 4', set5: 'Set 5',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function rangeLabel(startIndex: number): string {
  return `問${startIndex + 1}〜${startIndex + 10}`
}

export default async function HistoryPage() {
  const [sessions, setStats] = await Promise.all([
    getRecentSessions(30),
    getAllSetStats(),
  ])

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">学習履歴</h1>

      {/* 問題集別正答率バーグラフ */}
      <div>
        <h2 className="text-lg font-semibold mb-3">問題集別 正答率</h2>
        <div className="space-y-2">
          {setStats.map(({ examSet, totalAnswered, correctCount }) => {
            const rate = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0
            return (
              <div key={examSet} className="flex items-center gap-3">
                <span className="w-12 text-sm text-gray-600">{SET_LABELS[examSet]}</span>
                <div className="flex-1 h-5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${rate}%` }}
                  />
                </div>
                <span className="w-16 text-sm text-right text-gray-700">
                  {rate}% ({totalAnswered}問)
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* セッション一覧 */}
      <div>
        <h2 className="text-lg font-semibold mb-3">直近のセッション</h2>
        {sessions.length === 0 ? (
          <p className="text-gray-500">まだセッションがありません。</p>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-3 text-left">問題集</th>
                  <th className="p-3 text-left">範囲</th>
                  <th className="p-3 text-center">スコア</th>
                  <th className="p-3 text-right">完了日時</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3">
                      <Link
                        href={`/result/${s.exam_set}`}
                        className="text-blue-600 hover:underline"
                      >
                        {SET_LABELS[s.exam_set as ExamSet]}
                      </Link>
                    </td>
                    <td className="p-3 text-gray-600">{rangeLabel(s.start_index)}</td>
                    <td className="p-3 text-center font-medium">
                      {s.score != null ? `${s.score} / 10` : '-'}
                    </td>
                    <td className="p-3 text-right text-gray-500">
                      {s.completed_at ? formatDate(s.completed_at) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 開発サーバーで動作確認**

```bash
npm run dev
```

http://localhost:3000/history を開き、正答率バーグラフとセッション一覧が表示されることを確認。Ctrl+Cで停止。

- [ ] **Step 3: コミット**

```bash
git add src/app/history/page.tsx
git commit -m "feat: add history page with bar chart and session list"
```

---

## Task 9: Vercelデプロイ

**Files:**
- 変更なし（Vercelの設定はダッシュボードで行う）

- [ ] **Step 1: GitHubにリポジトリを作成してpush**

```bash
gh repo create saa-questions --private --source=. --push
```

または GitHub上で手動作成後:
```bash
git remote add origin https://github.com/<username>/saa-questions.git
git push -u origin main
```

- [ ] **Step 2: Vercelにデプロイ**

1. https://vercel.com にアクセス → 「Add New Project」
2. GitHubリポジトリ `saa-questions` をインポート
3. 「Environment Variables」に以下を追加:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. 「Deploy」をクリック

- [ ] **Step 3: デプロイ後の動作確認**

デプロイ完了後、発行されたVercel URLにアクセスし:
1. トップ画面が表示される
2. クイズが正常に動作する
3. 結果画面・履歴画面が開く

---

## セルフレビュー

### スペックカバレッジ確認

| 仕様 | 対応Task |
|---|---|
| Set 1〜5の選択 | Task 5 (トップ画面) |
| 10問セッション単位 | Task 4, 6 |
| Q→A→Qフロー | Task 6 (QuizClient) |
| 単一/複数選択対応 | Task 6 (`isMultiple`) |
| 回答後の解説6項目 | Task 6 (解説UI) |
| 結果マトリクス（65問×挑戦回数） | Task 7 |
| セル: 選んだ選択肢 + 緑/赤背景 | Task 7 |
| Setタブ切り替え | Task 7 |
| 履歴画面 | Task 8 |
| JSONからのsync | Task 3 |
| Vercelデプロイ | Task 9 |
