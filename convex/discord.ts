"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

declare const process: {
  env: {
    DISCORD_CLIENT_SECRET?: string;
    DISCORD_REDIRECT_URI?: string;
  };
};

type DiscordTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

export const exchangeDiscordCode = action({
  args: {
    code: v.string(),
    clientId: v.string(),
  },
  handler: async (_, args) => {
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;

    if (!clientSecret) {
      throw new Error("DISCORD_CLIENT_SECRET is required for Discord auth.");
    }

    if (!redirectUri) {
      throw new Error("DISCORD_REDIRECT_URI is required for Discord auth.");
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: args.code,
      client_id: args.clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const data = (await response.json()) as DiscordTokenResponse;

    if (!response.ok || !data.access_token) {
      throw new Error(
        data.error_description ??
          data.error ??
          "Discord token exchange failed.",
      );
    }

    return {
      accessToken: data.access_token,
    };
  },
});
