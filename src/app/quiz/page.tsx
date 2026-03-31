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
