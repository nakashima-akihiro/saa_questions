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

export async function getIncompleteSession(
  examSet: ExamSet,
  startIndex: number
): Promise<{ session: Session; initialIndex: number; initialScore: number } | null> {
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('exam_set', examSet)
    .eq('start_index', startIndex)
    .is('completed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!sessions || sessions.length === 0) return null

  const session = sessions[0] as Session

  const { data: answers } = await supabase
    .from('answers')
    .select('is_correct')
    .eq('session_id', session.id)

  const initialIndex = answers?.length ?? 0
  const initialScore = answers?.filter(a => a.is_correct).length ?? 0

  return { session, initialIndex, initialScore }
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
