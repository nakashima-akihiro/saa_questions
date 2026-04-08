import { redirect } from 'next/navigation'
import { getQuestions } from '../actions/questions'
import { createSession, getIncompleteSession } from '../actions/sessions'
import QuizClient from './QuizClient'
import type { ExamSet } from '@/types'

export const dynamic = 'force-dynamic'

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

  const resumed = await getIncompleteSession(examSet, startIndex)
  const session = resumed?.session ?? await createSession(examSet, startIndex)
  const initialIndex = Math.min(resumed?.initialIndex ?? 0, questions.length - 1)
  const initialScore = resumed?.initialScore ?? 0

  return (
    <QuizClient
      session={session}
      questions={questions}
      initialIndex={initialIndex}
      initialScore={initialScore}
      isResumed={!!resumed}
    />
  )
}
