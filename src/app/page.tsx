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
