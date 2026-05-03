export type LessonConcept = {
  subject: string
  importance: number
  difficulty: number
  roadblock: string
}

export type PracticePrompt = {
  englishSentence: string
  wordHints: string[]
}

export type GradeResult = {
  passed: boolean
  weaknesses: Array<{
    weakness: string
    severity: number
  }>
  feedback: string
}

export type PreparedPractice = {
  prompt: PracticePrompt
  subjects: LessonConcept[]
}
