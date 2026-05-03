import type { FormEvent, Ref } from 'react'

type PracticeAnswerFormProps = {
  answer: string
  disabled: boolean
  inputRef: Ref<HTMLTextAreaElement>
  isGrading: boolean
  onAnswerChange: (answer: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function PracticeAnswerForm({
  answer,
  disabled,
  inputRef,
  isGrading,
  onAnswerChange,
  onSubmit,
}: PracticeAnswerFormProps) {
  return (
    <form className="bottom-bar" onSubmit={onSubmit}>
      <textarea
        ref={inputRef}
        className="input-field"
        onChange={(event) => onAnswerChange(event.target.value)}
        placeholder="Escribe tu traducción aquí..."
        rows={2}
        value={answer}
        disabled={disabled}
      />
      <button
        className="btn btn--primary btn--full"
        disabled={disabled || !answer.trim()}
        type="submit"
      >
        {isGrading ? 'Grading...' : 'Submit'}
      </button>
    </form>
  )
}
