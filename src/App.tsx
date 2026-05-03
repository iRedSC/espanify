import { DiscordSDK } from '@discord/embedded-app-sdk'
import { useAction, useMutation } from 'convex/react'
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
      <div className="center-state">
        <h1>Setup needed</h1>
        <p>
          Add <code>VITE_CONVEX_URL</code> to start practicing.
        </p>
      </div>
    </main>
  )
}

function ConnectedApp() {
  const registerDiscordUser = useMutation(api.users.registerDiscordUser)
  const exchangeDiscordCode = useAction(api.discord.exchangeDiscordCode)
  const [status, setStatus] = useState<AppStatus>('idle')
  const [discordId, setDiscordId] = useState<string>()
  const [errorMessage, setErrorMessage] = useState<string>()

  useEffect(() => {
    let isMounted = true

    async function initializeLearner() {
      try {
        const nextDiscordId = await getDiscordId(exchangeDiscordCode)
        await registerDiscordUser({ discordId: nextDiscordId })

        if (isMounted) {
          setDiscordId(nextDiscordId)
          setStatus('ready')
        }
      } catch (error) {
        if (isMounted) {
          setStatus('error')
          setErrorMessage(getErrorMessage(error))
        }
      }
    }

    initializeLearner()

    return () => {
      isMounted = false
    }
  }, [exchangeDiscordCode, registerDiscordUser])

  return (
    <main className="activity-shell">
      {status === 'ready' && discordId ? (
        <SpanishPractice discordId={discordId} />
      ) : (
        <div className="center-state">
          <h1>espanify</h1>
          <p>
            {status === 'error'
              ? (errorMessage ?? 'Could not initialize your learner profile.')
              : 'Connecting...'}
          </p>
        </div>
      )}
    </main>
  )
}

async function getDiscordId(
  exchangeDiscordCode: (args: {
    code: string
    clientId: string
  }) => Promise<{ accessToken: string }>,
) {
  if (!clientId || !isDiscordEnvironment()) {
    return localDiscordId
  }

  const discordSdk = new DiscordSDK(clientId)
  await discordSdk.ready()

  const { code } = await discordSdk.commands.authorize({
    client_id: clientId,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify'],
  })
  const { accessToken } = await exchangeDiscordCode({
    code,
    clientId,
  })
  const auth = await discordSdk.commands.authenticate({
    access_token: accessToken,
  })

  return auth.user.id
}

function isDiscordEnvironment() {
  return (
    window.location.hostname.endsWith('.discordsays.com') ||
    window.parent !== window
  )
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  try {
    return JSON.stringify(error)
  } catch {
    return 'Could not initialize your learner profile.'
  }
}

export default App
