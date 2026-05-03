import type { PracticePrompt } from '../types'

type PracticePromptCardsProps = {
  error?: string
  prompt: PracticePrompt
  subjectsForDisplay: string
}

export function PracticePromptCards({
  error,
  prompt,
  subjectsForDisplay,
}: PracticePromptCardsProps) {
  return (
    <div className="main-area">
      <div className="card">
        <p className="label">Translate to Spanish</p>
        <p className="sentence">{prompt.englishSentence}</p>
        {subjectsForDisplay && (
          <p className="focus-text" style={{ marginTop: 8 }}>
            {subjectsForDisplay}
          </p>
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
  )
}
