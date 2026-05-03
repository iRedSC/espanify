import { useAction, useMutation, useQuery } from 'convex/react'
import type { FormEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
import { api } from '../convex/_generated/api'
import { chooseSubjects } from './practice/chooseSubjects'
import { PracticeAnswerForm } from './practice/components/PracticeAnswerForm'
import { PracticePromptCards } from './practice/components/PracticePromptCards'
import { PracticeStart } from './practice/components/PracticeStart'
import { ResultModal } from './practice/components/ResultModal'
import { StatusBar } from './practice/components/StatusBar'
import type {
  GradeResult,
  LessonConcept,
  PracticePrompt,
  PreparedPractice,
} from './practice/types'

type SpanishPracticeProps = {
  discordId: string
}

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
          <PracticePromptCards
            error={error}
            prompt={prompt}
            subjectsForDisplay={subjectsForDisplay}
          />

          <PracticeAnswerForm
            answer={answer}
            disabled={isGrading || Boolean(result)}
            inputRef={inputRef}
            isGrading={isGrading}
            onAnswerChange={setAnswer}
            onSubmit={handleSubmit}
          />

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
        <PracticeStart isGenerating={isGenerating} onStart={handleGeneratePrompt} />
      )}
    </>
  )
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
