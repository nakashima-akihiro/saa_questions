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
