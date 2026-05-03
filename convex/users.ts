import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const registerDiscordUser = mutation({
  args: {
    discordId: v.string(),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_discord_id", (q) => q.eq("discordId", args.discordId))
      .unique();

    if (existingUser) {
      return existingUser._id;
    }

    return await ctx.db.insert("users", {
      discordId: args.discordId,
      level: 1,
    });
  },
});
