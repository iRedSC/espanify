import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    discordId: v.string(),
    level: v.number(),
    points: v.number(),
  }).index("by_discord_id", ["discordId"]),

  weaknesses: defineTable({
    user: v.id("users"),
    weakness: v.string(),
    severity: v.number(),
  })
    .index("by_user", ["user"])
    .index("by_user_weakness", ["user", "weakness"]),
});
