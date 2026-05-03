import { useAction, useMutation, useQuery } from 'convex/react'
import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { parse } from 'yaml'
import { api } from '../convex/_generated/api'
import conceptsYaml from './lessons/concepts.yml?raw'

type LessonConcept = {
  subject: string
  importance: number
  difficulty: number
  roadblock: string
}

type PracticePrompt = {
  englishSentence: string
  wordHints: Array<{
    english: string
    spanish: string
  }>
}

type GradeResult = {
  passed: boolean
  weaknesses: Array<{
    weakness: string
    severity: number
  }>
  feedback: string
}

type SpanishPracticeProps = {
  discordId: string
}

const conceptsByLevel = parse(conceptsYaml) as Record<string, LessonConcept[]>
const concepts = Object.values(conceptsByLevel).flat()

export function SpanishPractice({ discordId }: SpanishPracticeProps) {
  const learningState = useQuery(api.users.getLearningState, { discordId })
  const generatePrompt = useAction(api.ai.generatePracticePrompt)
  const gradeTranslation = useAction(api.ai.gradeTranslation)
  const applyPracticeResult = useMutation(api.users.applyPracticeResult)
  const [prompt, setPrompt] = useState<PracticePrompt>()
  const [selectedSubjects, setSelectedSubjects] = useState<LessonConcept[]>([])
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<GradeResult>()
  const [error, setError] = useState<string>()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGrading, setIsGrading] = useState(false)

  const subjectsForDisplay = useMemo(
    () => selectedSubjects.map((subject) => subject.subject).join(', '),
    [selectedSubjects],
  )

  if (learningState === undefined) {
    return <p className="loading">Loading your learner profile...</p>
  }

  if (learningState === null) {
    return <p className="loading">Creating your learner profile...</p>
  }

  async function handleGeneratePrompt() {
    if (!learningState) {
      return
    }

    const nextSubjects = chooseSubjects(
      learningState.level,
      learningState.weaknesses,
    )

    setIsGenerating(true)
    setError(undefined)
    setResult(undefined)
    setAnswer('')

    try {
      const nextPrompt = await generatePrompt({
        level: learningState.level,
        subjects: nextSubjects,
        weaknesses: learningState.weaknesses,
      })
      setSelectedSubjects(nextSubjects)
      setPrompt(nextPrompt)
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'Could not generate a sentence.'))
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!prompt || !answer.trim()) {
      return
    }

    setIsGrading(true)
    setError(undefined)

    try {
      const nextResult = await gradeTranslation({
        englishSentence: prompt.englishSentence,
        spanishAnswer: answer,
        subjects: selectedSubjects,
      })

      await applyPracticeResult({
        discordId,
        passed: nextResult.passed,
        weaknesses: nextResult.weaknesses,
      })

      setResult(nextResult)
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'Could not grade your answer.'))
    } finally {
      setIsGrading(false)
    }
  }

  return (
    <section className="practice-card">
      <div className="stats-row" aria-label="Learning progress">
        <span>Level {learningState.level}</span>
        <span>{learningState.points}/10 points</span>
      </div>

      <div>
        <p className="eyebrow">Spanish translation practice</p>
        <h1>Translate one sentence at a time.</h1>
        <p className="lede">
          Espanify picks grammar just above your current level, uses your saved
          weaknesses, and grades each Spanish answer.
        </p>
      </div>

      {prompt ? (
        <form className="lesson-panel" onSubmit={handleSubmit}>
          <div>
            <p className="panel-label">English sentence</p>
            <p className="sentence">{prompt.englishSentence}</p>
          </div>

          <div>
            <p className="panel-label">Focus</p>
            <p>{subjectsForDisplay}</p>
          </div>

          <div>
            <p className="panel-label">Word hints</p>
            <ul className="hint-list">
              {prompt.wordHints.map((hint) => (
                <li key={`${hint.english}-${hint.spanish}`}>
                  <span>{hint.english}</span>
                  <strong>{hint.spanish}</strong>
                </li>
              ))}
            </ul>
          </div>

          <label className="answer-field">
            Your Spanish translation
            <textarea
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Escribe tu traduccion aqui..."
              rows={4}
              value={answer}
            />
          </label>

          <div className="button-row">
            <button disabled={isGrading || !answer.trim()} type="submit">
              {isGrading ? 'Grading...' : 'Grade answer'}
            </button>
            <button
              disabled={isGenerating || isGrading}
              onClick={handleGeneratePrompt}
              type="button"
            >
              New sentence
            </button>
          </div>
        </form>
      ) : (
        <div className="empty-state">
          <p>Start a short practice round tailored to your current level.</p>
          <button
            disabled={isGenerating}
            onClick={handleGeneratePrompt}
            type="button"
          >
            {isGenerating ? 'Generating...' : 'Generate sentence'}
          </button>
        </div>
      )}

      {result ? (
        <div className={`result-card ${result.passed ? 'passed' : 'failed'}`}>
          <h2>{result.passed ? 'Pass' : 'Try again'}</h2>
          <p>{result.feedback}</p>
          {result.weaknesses.length > 0 ? (
            <ul className="weakness-list">
              {result.weaknesses.map((weakness) => (
                <li key={weakness.weakness}>
                  {weakness.weakness} <span>{weakness.severity}/10</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {learningState.weaknesses.length > 0 ? (
        <aside className="weakness-summary">
          <h2>Current weaknesses</h2>
          <ul className="weakness-list">
            {learningState.weaknesses.slice(0, 5).map((weakness) => (
              <li key={weakness.weakness}>
                {weakness.weakness} <span>{weakness.severity}/10</span>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}

      {error ? <p className="error-message">{error}</p> : null}
    </section>
  )
}

function chooseSubjects(
  level: number,
  weaknesses: Array<{ weakness: string; severity: number }>,
) {
  const preferredWeaknesses = weaknesses.map((weakness) =>
    weakness.weakness.toLowerCase(),
  )
  const levelMatched = concepts.filter(
    (concept) => concept.difficulty >= level && concept.difficulty <= level + 2,
  )
  const pool = levelMatched.length > 0 ? levelMatched : concepts

  const ranked = [...pool].sort((a, b) => {
    const weaknessRank =
      weaknessScore(b, preferredWeaknesses) - weaknessScore(a, preferredWeaknesses)
    return weaknessRank || b.importance - a.importance || a.difficulty - b.difficulty
  })
  const count = Math.min(ranked.length, Math.random() > 0.45 ? 2 : 1)

  return ranked.slice(0, count)
}

function weaknessScore(concept: LessonConcept, weaknesses: string[]) {
  const subject = concept.subject.toLowerCase()
  return weaknesses.some(
    (weakness) => subject.includes(weakness) || weakness.includes(subject),
  )
    ? 1
    : 0
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
