import { useAction } from 'convex/react'
import { useState } from 'react'
import { api } from '../convex/_generated/api'

export function MoodGenerator() {
  const describeRandomMood = useAction(api.ai.describeRandomMoodAction)
  const [mood, setMood] = useState<string>()
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)

  async function handleDescribeMood() {
    setIsLoading(true)
    setError(undefined)

    try {
      const nextMood = await describeRandomMood({})
      setMood(nextMood)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to describe a mood.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="mood-card" aria-live="polite">
      <h2>OpenAI mood test</h2>
      {mood ? (
        <p className="mood-result">{mood}</p>
      ) : (
        <p>Click the button to ask OpenAI to describe a random mood.</p>
      )}
      {error ? <p className="mood-error">{error}</p> : null}
      <button
        className="mood-button"
        disabled={isLoading}
        onClick={handleDescribeMood}
        type="button"
      >
        {isLoading ? 'Asking OpenAI...' : 'Describe a random mood'}
      </button>
    </section>
  )
}

export function MoodGeneratorUnavailable() {
  return (
    <section className="mood-card" aria-live="polite">
      <h2>OpenAI mood test</h2>
      <p>Add <code>VITE_CONVEX_URL</code> to enable the Trigger.dev mood task.</p>
      <button className="mood-button" disabled type="button">
        Describe a random mood
      </button>
    </section>
  )
}
