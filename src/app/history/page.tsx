import Link from 'next/link'
import { getRecentSessions } from '../actions/sessions'
import { getAllSetStats } from '../actions/questions'
import type { ExamSet } from '@/types'

export const dynamic = 'force-dynamic'

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
