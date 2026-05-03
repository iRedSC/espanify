import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { patchUrlMappings } from '@discord/embedded-app-sdk'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import './index.css'
import App from './App.tsx'

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
patchConvexUrlMapping(convexUrl)

const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

const app = convex ? (
  <ConvexProvider client={convex}>
    <App />
  </ConvexProvider>
) : (
  <App />
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {app}
  </StrictMode>,
)

function patchConvexUrlMapping(convexUrl: string | undefined) {
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined
  const isDiscordProxy =
    clientId && window.location.hostname === `${clientId}.discordsays.com`

  if (!convexUrl || !isDiscordProxy) {
    return
  }

  patchUrlMappings([
    {
      prefix: '/convex',
      target: new URL(convexUrl).hostname,
    },
  ])
}
