import { DiscordSDK } from '@discord/embedded-app-sdk'
import { useEffect, useState } from 'react'
import './App.css'

type DiscordStatus = 'idle' | 'ready' | 'missing-client-id' | 'error'

const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID

function App() {
  const [status, setStatus] = useState<DiscordStatus>(
    clientId ? 'idle' : 'missing-client-id',
  )
  const [errorMessage, setErrorMessage] = useState<string>()

  useEffect(() => {
    if (!clientId) {
      return
    }

    let isMounted = true
    const discordSdk = new DiscordSDK(clientId)

    async function initializeDiscord() {
      try {
        await discordSdk.ready()

        if (isMounted) {
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
  }, [])

  return (
    <main className="activity-shell">
      <section className="hero">
        <p className="eyebrow">Discord Activity Starter</p>
        <h1>Vite + React is ready for Discord.</h1>
        <p className="lede">
          This app initializes the Discord Embedded App SDK and waits for
          Discord to mark the activity as ready.
        </p>
      </section>

      <section className="status-card" aria-live="polite">
        <span className={`status-dot status-dot--${status}`} />
        <div>
          <h2>{getStatusTitle(status)}</h2>
          <p>{getStatusDescription(status, errorMessage)}</p>
        </div>
      </section>

      <section className="next-steps">
        <h2>Next steps</h2>
        <ol>
          <li>
            Add your Discord app client ID to <code>.env.local</code>.
          </li>
          <li>
            Start Vite with <code>pnpm dev</code>.
          </li>
          <li>
            Point your Discord Activity URL mapping at your HTTPS tunnel.
          </li>
        </ol>
      </section>
    </main>
  )
}

function getStatusTitle(status: DiscordStatus) {
  switch (status) {
    case 'ready':
      return 'Connected to Discord'
    case 'missing-client-id':
      return 'Client ID needed'
    case 'error':
      return 'Discord SDK failed to initialize'
    default:
      return 'Waiting for Discord'
  }
}

function getStatusDescription(status: DiscordStatus, errorMessage?: string) {
  switch (status) {
    case 'ready':
      return 'The activity called discordSdk.ready() successfully.'
    case 'missing-client-id':
      return 'Create .env.local and set VITE_DISCORD_CLIENT_ID to your Discord application client ID.'
    case 'error':
      return errorMessage ?? 'Check that the app is running inside Discord and your client ID is correct.'
    default:
      return 'Open this URL from a Discord Activity launch to complete initialization.'
  }
}

export default App
