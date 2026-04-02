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
  // 問題一覧を取得（1クエリ）
  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('id, order')
    .eq('exam_set', examSet)
    .order('order', { ascending: true })

  if (qErr) throw new Error(qErr.message)
  if (!questions || questions.length === 0) return []

  // 全問題の回答を一括取得（1クエリ）
  const questionIds = questions.map(q => q.id)
  const { data: answers, error: aErr } = await supabase
    .from('answers')
    .select('question_id, selected, is_correct, answered_at')
    .in('question_id', questionIds)
    .order('answered_at', { ascending: true })

  if (aErr) throw new Error(aErr.message)

  // question_id でグループ化
  const answersByQuestion = new Map<string, typeof answers>()
  for (const a of answers ?? []) {
    const list = answersByQuestion.get(a.question_id) ?? []
    list.push(a)
    answersByQuestion.set(a.question_id, list)
  }

  return questions.map(q => {
    const qAnswers = answersByQuestion.get(q.id) ?? []
    return {
      order: q.order,
      totalAttempts: qAnswers.length,
      correctCount: qAnswers.filter(a => a.is_correct).length,
      history: qAnswers.map((a, i) => ({
        attempt: i + 1,
        selected: a.selected,
        is_correct: a.is_correct,
      })),
    }
  })
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
