type PracticeStartProps = {
  isGenerating: boolean
  onStart: () => void
}

export function PracticeStart({ isGenerating, onStart }: PracticeStartProps) {
  return (
    <div className="center-state">
      <h1>Ready to practice?</h1>
      <p>
        Translate sentences tailored to your level. Each answer earns points toward the next level.
      </p>
      <button
        className="btn btn--primary"
        disabled={isGenerating}
        onClick={onStart}
        type="button"
      >
        {isGenerating ? 'Generating...' : 'Start'}
      </button>
    </div>
  )
}
