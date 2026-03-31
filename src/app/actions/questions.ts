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
