import { useAction, useMutation, useQuery } from 'convex/react'
import type { FormEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
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
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const subjectsForDisplay = useMemo(
    () => selectedSubjects.map((subject) => subject.subject).join(', '),
    [selectedSubjects],
  )

  if (learningState === undefined) {
    return (
      <>
        <StatusBar level={0} points={0} />
        <div className="center-state">
          <p>Loading your profile...</p>
        </div>
      </>
    )
  }

  if (learningState === null) {
    return (
      <>
        <StatusBar level={0} points={0} />
        <div className="center-state">
          <p>Creating your profile...</p>
        </div>
      </>
    )
  }

  async function handleGeneratePrompt() {
    if (!learningState) return

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
      setTimeout(() => inputRef.current?.focus(), 100)
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'Could not generate a sentence.'))
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!prompt || !answer.trim()) return

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
    <>
      <StatusBar level={learningState.level} points={learningState.points} />

      {prompt ? (
        <>
          <div className="main-area">
            <div className="card">
              <p className="label">Translate to Spanish</p>
              <p className="sentence">{prompt.englishSentence}</p>
              {subjectsForDisplay && (
                <p className="focus-text" style={{ marginTop: 8 }}>{subjectsForDisplay}</p>
              )}
            </div>

            <div className="card">
              <p className="label">Word hints</p>
              <ul className="chip-list">
                {prompt.wordHints.map((hint) => (
                  <li className="chip" key={`${hint.english}-${hint.spanish}`}>
                    <span>{hint.english}</span>
                    <strong>{hint.spanish}</strong>
                  </li>
                ))}
              </ul>
            </div>

            {result && (
              <div className={`card card--result ${result.passed ? '' : 'failed'}`}>
                <p className="result-header">{result.passed ? 'Correct!' : 'Not quite'}</p>
                <p className="result-feedback">{result.feedback}</p>
                {result.weaknesses.length > 0 && (
                  <div className="weakness-section">
                    <h3>Areas to improve</h3>
                    <ul className="chip-list">
                      {result.weaknesses.map((w) => (
                        <li className="chip" key={w.weakness}>
                          {w.weakness} <strong>{w.severity}/10</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {error && <p className="error-text">{error}</p>}
          </div>

          <form className="bottom-bar" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              className="input-field"
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Escribe tu traducción aquí..."
              rows={2}
              value={answer}
            />
            <div className="btn-row">
              <button
                className="btn btn--primary"
                disabled={isGrading || !answer.trim()}
                type="submit"
              >
                {isGrading ? 'Grading...' : 'Submit'}
              </button>
              <button
                className="btn btn--secondary"
                disabled={isGenerating || isGrading}
                onClick={handleGeneratePrompt}
                type="button"
              >
                {isGenerating ? 'Loading...' : 'Next'}
              </button>
            </div>
          </form>
        </>
      ) : (
        <div className="center-state">
          <h1>Ready to practice?</h1>
          <p>
            Translate sentences tailored to your level. Each answer earns points toward the next level.
          </p>
          <button
            className="btn btn--primary"
            disabled={isGenerating}
            onClick={handleGeneratePrompt}
            type="button"
          >
            {isGenerating ? 'Generating...' : 'Start'}
          </button>
        </div>
      )}
    </>
  )
}

function StatusBar({ level, points }: { level: number; points: number }) {
  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="status-bar-title">espanify</span>
      </div>
      <div className="status-bar-right">
        <span className="badge">Lv {level}</span>
        <span className="badge badge--points">{points}/10</span>
      </div>
    </div>
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
