import { DiscordSDK } from '@discord/embedded-app-sdk'
import { useMutation } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../convex/_generated/api'
import './App.css'
import { SpanishPractice } from './SpanishPractice'

type AppStatus = 'idle' | 'ready' | 'error'

const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID
const hasConvexUrl = Boolean(import.meta.env.VITE_CONVEX_URL)
const localDiscordId = 'local-espanify-learner'

function App() {
  if (hasConvexUrl) {
    return <ConnectedApp />
  }

  return (
    <main className="activity-shell">
      <section className="practice-card">
        <p className="eyebrow">Configuration needed</p>
        <h1>Connect Convex to start practicing.</h1>
        <p className="lede">
          Add <code>VITE_CONVEX_URL</code> to enable the Spanish learning flow.
        </p>
      </section>
    </main>
  )
}

function ConnectedApp() {
  const registerDiscordUser = useMutation(api.users.registerDiscordUser)
  const [status, setStatus] = useState<AppStatus>('idle')
  const [discordId, setDiscordId] = useState<string>()
  const [errorMessage, setErrorMessage] = useState<string>()

  useEffect(() => {
    if (!clientId) {
      registerDiscordUser({ discordId: localDiscordId })
        .then(() => {
          setDiscordId(localDiscordId)
          setStatus('ready')
        })
        .catch((error) => {
          setStatus('error')
          setErrorMessage(error instanceof Error ? error.message : 'Unknown error')
        })
      return
    }

    let isMounted = true
    const discordSdk = new DiscordSDK(clientId)

    async function initializeDiscord() {
      try {
        await discordSdk.ready()

        const { user } = await discordSdk.commands.authenticate({})
        await registerDiscordUser({ discordId: user.id })

        if (isMounted) {
          setDiscordId(user.id)
          setStatus('ready')
        }
      } catch (error) {
        if (isMounted) {
          setStatus('error')
          setErrorMessage(error instanceof Error ? error.message : 'Unknown error')
        }
      }
    }

    initializeDiscord()

    return () => {
      isMounted = false
    }
  }, [registerDiscordUser])

  return (
    <main className="activity-shell">
      {status === 'ready' && discordId ? (
        <SpanishPractice discordId={discordId} />
      ) : (
        <section className="practice-card" aria-live="polite">
          <p className="eyebrow">Espanify</p>
          <h1>Preparing your Spanish practice.</h1>
          <p className="lede">
            {status === 'error'
              ? (errorMessage ?? 'Could not initialize your learner profile.')
              : 'Connecting to your learner profile...'}
          </p>
        </section>
      )}
    </main>
  )
}

export default App
