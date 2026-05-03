import type { GradeResult } from '../types'

type ResultModalProps = {
  isPreparingNext: boolean
  nextPromptError?: string
  onNext: () => Promise<void> | void
  result: GradeResult
}

export function ResultModal({
  isPreparingNext,
  nextPromptError,
  onNext,
  result,
}: ResultModalProps) {
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
              {result.weaknesses.map((weakness) => (
                <li className="chip" key={weakness.weakness}>
                  {weakness.weakness} <strong>{weakness.severity}/10</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
        {nextPromptError && <p className="error-text">{nextPromptError}</p>}
        <button
          className="btn btn--primary btn--full"
          disabled={isPreparingNext}
          onClick={() => void onNext()}
          type="button"
        >
          {isPreparingNext ? 'Preparing next...' : 'Next'}
        </button>
      </div>
    </div>
  )
}
