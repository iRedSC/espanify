# Espanify Discord Activity

A basic Discord Activity starter built with Vite, React, TypeScript, and the
Discord Embedded App SDK.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the example environment file and add your Discord application client ID:

   ```bash
   cp .env.example .env.local
   ```

   ```env
   VITE_DISCORD_CLIENT_ID=your_discord_application_client_id
   ```

3. Start the dev server:

   ```bash
   pnpm dev
   ```

The Vite server is configured for `http://localhost:3000`.

## Run In Discord

Discord Activities need to load from an HTTPS URL. For local development, expose
Vite with a tunnel such as Cloudflare Tunnel, ngrok, or the tunnel provider you
prefer.

1. Create an application in the
   [Discord Developer Portal](https://discord.com/developers/applications).
2. Enable Activities for the application.
3. Add a URL mapping that points to your HTTPS tunnel URL.
4. Launch the activity from Discord.

When Discord loads the app, `src/App.tsx` creates a `DiscordSDK` instance with
`VITE_DISCORD_CLIENT_ID` and calls `discordSdk.ready()`.

## Scripts

- `pnpm dev` starts Vite on port `3000`.
- `pnpm build` type-checks and builds the app.
- `pnpm lint` runs ESLint.
- `pnpm preview` serves the production build locally.
