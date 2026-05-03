import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const INITIAL_LEVEL = 1;
const POINTS_PER_LEVEL = 10;

export const registerDiscordUser = mutation({
  args: {
    discordId: v.string(),
  },
  handler: async (ctx, args) => {
    const existingUser = await getUserByDiscordId(ctx, args.discordId);

    if (existingUser) {
      if (existingUser.points === undefined) {
        await ctx.db.patch(existingUser._id, { points: 0 });
      }

      return existingUser._id;
    }

    return await ctx.db.insert("users", {
      discordId: args.discordId,
      level: INITIAL_LEVEL,
      points: 0,
    });
  },
});

export const getLearningState = query({
  args: {
    discordId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserByDiscordId(ctx, args.discordId);

    if (!user) {
      return null;
    }

    const weaknesses = await ctx.db
      .query("weaknesses")
      .withIndex("by_user", (q) => q.eq("user", user._id))
      .collect();

    return {
      level: user.level,
      points: user.points ?? 0,
      weaknesses: weaknesses
        .map((weakness) => ({
          weakness: weakness.weakness,
          severity: weakness.severity,
        }))
        .sort((a, b) => b.severity - a.severity),
    };
  },
});

export const applyPracticeResult = mutation({
  args: {
    discordId: v.string(),
    passed: v.boolean(),
    weaknesses: v.array(
      v.object({
        weakness: v.string(),
        severity: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let user = await getUserByDiscordId(ctx, args.discordId);

    if (!user) {
      const userId = await ctx.db.insert("users", {
        discordId: args.discordId,
        level: INITIAL_LEVEL,
        points: 0,
      });
      user = await ctx.db.get(userId);
    }

    if (!user) {
      throw new Error("Unable to create learner profile.");
    }

    const updatedWeaknesses = normalizeWeaknesses(args.weaknesses);
    const updatedNames = new Set(updatedWeaknesses.map((item) => item.weakness));
    const existingWeaknesses = await ctx.db
      .query("weaknesses")
      .withIndex("by_user", (q) => q.eq("user", user._id))
      .collect();

    for (const weakness of updatedWeaknesses) {
      const existing = await ctx.db
        .query("weaknesses")
        .withIndex("by_user_weakness", (q) =>
          q.eq("user", user._id).eq("weakness", weakness.weakness),
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { severity: weakness.severity });
      } else {
        await ctx.db.insert("weaknesses", {
          user: user._id,
          weakness: weakness.weakness,
          severity: weakness.severity,
        });
      }
    }

    for (const weakness of existingWeaknesses) {
      if (updatedNames.has(weakness.weakness)) {
        continue;
      }

      const nextSeverity = weakness.severity - 1;

      if (nextSeverity <= 0) {
        await ctx.db.delete(weakness._id);
      } else {
        await ctx.db.patch(weakness._id, { severity: nextSeverity });
      }
    }

    let nextLevel = user.level;
    let nextPoints = args.passed ? (user.points ?? 0) + 1 : (user.points ?? 0) - 1;

    if (nextPoints < 0) {
      nextPoints = 0;
    }

    while (nextPoints >= POINTS_PER_LEVEL) {
      nextPoints -= POINTS_PER_LEVEL;
      nextLevel += 1;
    }

    await ctx.db.patch(user._id, {
      level: nextLevel,
      points: nextPoints,
    });

    return {
      level: nextLevel,
      points: nextPoints,
    };
  },
});

async function getUserByDiscordId(
  ctx: QueryCtx | MutationCtx,
  discordId: string,
) {
  return await ctx.db
    .query("users")
    .withIndex("by_discord_id", (q) => q.eq("discordId", discordId))
    .unique();
}

function normalizeWeaknesses(
  weaknesses: Array<{ weakness: string; severity: number }>,
) {
  const byName = new Map<string, number>();

  for (const weakness of weaknesses) {
    const name = weakness.weakness.trim().toLowerCase();

    if (!name) {
      continue;
    }

    const severity = Math.min(10, Math.max(1, Math.round(weakness.severity)));
    byName.set(name, Math.max(byName.get(name) ?? 0, severity));
  }

  return [...byName].map(([weakness, severity]) => ({ weakness, severity }));
}
