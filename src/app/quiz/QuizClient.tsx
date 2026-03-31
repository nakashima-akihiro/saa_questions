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
