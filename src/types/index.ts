export type ExamSet = 'set1' | 'set2' | 'set3' | 'set4' | 'set5'

export type Keyword = {
  keyword: string
  pattern: '正解' | '誤り'
  reason: string
}

export type OptionAnalysis = {
  option: 'A' | 'B' | 'C' | 'D'
  text: string
  is_correct: boolean
  reason: string
}

export type Explanation = {
  key_conditions: string
  what_is_asked: string
  decision_axis: string
  keywords: Keyword[]
  options_analysis: OptionAnalysis[]
  essence: string
}

export type Question = {
  id: string
  exam_set: ExamSet
  order: number
  body: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  answer: string   // 'A' | 'B' | 'C' | 'D' | 'A,C' など
  explanation: Explanation
  domain: string | null
  created_at: string
}

export type Session = {
  id: string
  exam_set: ExamSet
  start_index: number
  score: number | null
  completed_at: string | null
  created_at: string
}

export type Answer = {
  id: string
  session_id: string
  question_id: string
  selected: string
  is_correct: boolean
  answered_at: string
}

// クイズ画面で使うセッション状態
export type QuizState = {
  session: Session
  questions: Question[]
  currentIndex: number   // 0-9
  answers: Answer[]
}
