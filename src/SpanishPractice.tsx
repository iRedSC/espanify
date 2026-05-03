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
  wordHints: string[]
}

type GradeResult = {
  passed: boolean
  weaknesses: Array<{
    weakness: string
    severity: number
  }>
  feedback: string
}

type PreparedPractice = {
  prompt: PracticePrompt
  subjects: LessonConcept[]
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
  const [preparedPractice, setPreparedPractice] = useState<PreparedPractice>()
  const [error, setError] = useState<string>()
  const [nextPromptError, setNextPromptError] = useState<string>()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGrading, setIsGrading] = useState(false)
  const [isPreparingNext, setIsPreparingNext] = useState(false)
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

    setIsGenerating(true)
    setError(undefined)
    setResult(undefined)
    setAnswer('')

    try {
      const practice = await createPractice(learningState)
      setSelectedSubjects(practice.subjects)
      setPrompt(practice.prompt)
      setTimeout(() => inputRef.current?.focus(), 100)
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'Could not generate a sentence.'))
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!learningState || !prompt || !answer.trim()) return

    setIsGrading(true)
    setError(undefined)
    setResult(undefined)
    setPreparedPractice(undefined)
    setNextPromptError(undefined)
    void prepareNextPractice()

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

  async function prepareNextPractice() {
    if (!learningState) return

    setIsPreparingNext(true)
    setNextPromptError(undefined)

    try {
      const practice = await createPractice(learningState)
      setPreparedPractice(practice)
      return practice
    } catch (caughtError) {
      setNextPromptError(
        getErrorMessage(caughtError, 'Could not prepare the next sentence.'),
      )
    } finally {
      setIsPreparingNext(false)
    }
  }

  async function handleNextPrompt() {
    const practice = preparedPractice ?? (await prepareNextPractice())

    if (!practice) return

    setPrompt(practice.prompt)
    setSelectedSubjects(practice.subjects)
    setAnswer('')
    setResult(undefined)
    setError(undefined)
    setPreparedPractice(undefined)
    setNextPromptError(undefined)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  async function createPractice(state: NonNullable<typeof learningState>) {
    const subjects = chooseSubjects(state.level, state.weaknesses)
    const nextPrompt = await generatePrompt({
      level: state.level,
      subjects,
      weaknesses: state.weaknesses,
    })

    return { prompt: nextPrompt, subjects }
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
                {prompt.wordHints.map((hint, index) => (
                  <li className="chip" key={`${hint}-${index}`}>
                    <strong>{hint}</strong>
                  </li>
                ))}
              </ul>
            </div>

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
              disabled={isGrading || Boolean(result)}
            />
            <button
              className="btn btn--primary btn--full"
              disabled={isGrading || Boolean(result) || !answer.trim()}
              type="submit"
            >
              {isGrading ? 'Grading...' : 'Submit'}
            </button>
          </form>

          {result && (
            <ResultModal
              isPreparingNext={isPreparingNext}
              nextPromptError={nextPromptError}
              onNext={handleNextPrompt}
              result={result}
            />
          )}
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

function ResultModal({
  isPreparingNext,
  nextPromptError,
  onNext,
  result,
}: {
  isPreparingNext: boolean
  nextPromptError?: string
  onNext: () => void
  result: GradeResult
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="result-title"
        aria-modal="true"
        className={`card card--result modal-card ${result.passed ? '' : 'failed'}`}
        role="dialog"
      >
        <p className="result-header" id="result-title">
          {result.passed ? 'Correct!' : 'Not quite'}
        </p>
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
        {nextPromptError && <p className="error-text">{nextPromptError}</p>}
        <button
          className="btn btn--primary btn--full"
          disabled={isPreparingNext}
          onClick={onNext}
          type="button"
        >
          {isPreparingNext ? 'Preparing next...' : 'Next'}
        </button>
      </div>
    </div>
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
