import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getQuestionStats } from '../../actions/questions'
import type { ExamSet } from '@/types'

export const dynamic = 'force-dynamic'

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
